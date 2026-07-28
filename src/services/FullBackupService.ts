import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { Attachment } from '../models/Attachment'
import type { Event } from '../models/Event'
import { attachmentRepository, eventRepository } from '../repositories'
import type { AttachmentRepository } from '../repositories/AttachmentRepository'
import type { EventRepository } from '../repositories/EventRepository'
import { MAX_ATTACHMENT_SIZE } from '../utils/attachments'
import { BackupService } from './BackupService'

const SCHEMA_VERSION = 1
const APP_VERSION = '0.1 Alpha'
const MAX_ATTACHMENTS = 1000
const MAX_TOTAL_ATTACHMENT_SIZE = 500 * 1024 * 1024
const MAX_WORKBOOK_SIZE = 50 * 1024 * 1024

interface ManifestAttachment {
  id: string
  eventId: string
  filename: string
  mimeType: string
  size: number
  type: Attachment['type']
  createdAt: string
  path: string
}

interface BackupManifest {
  schemaVersion: number
  appVersion: string
  exportedAt: string
  eventCount: number
  attachmentCount: number
  attachments: ManifestAttachment[]
}

export interface RestoreResult {
  eventCount: number
  attachmentCount: number
}

export interface MergeRestoreResult {
  addedEvents: number
  skippedEvents: number
  addedAttachments: number
  skippedAttachments: number
  eventCount: number
  attachmentCount: number
}

interface ParsedBackup {
  events: Event[]
  attachments: Attachment[]
}

const eventFingerprint = (event: Event): string => JSON.stringify([
  event.date, event.title.trim(), event.detail.trim(), event.category.trim(), event.amount ?? null,
  [...event.tags].map((tag) => tag.trim()).filter(Boolean).sort(),
])

const isSafePath = (path: string): boolean =>
  Boolean(path) && !path.includes('\\') && !path.startsWith('/') && !path.includes('\0') &&
  path.split('/').every((part) => part !== '' && part !== '.' && part !== '..')

const toZipPath = (attachment: Attachment): string => {
  const safeName = attachment.filename.replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^\.+/, '') || 'file'
  return `attachments/${attachment.id}-${safeName}`
}

const isManifest = (value: unknown): value is BackupManifest => {
  if (!value || typeof value !== 'object') return false
  const manifest = value as Partial<BackupManifest>
  return manifest.schemaVersion === SCHEMA_VERSION && typeof manifest.appVersion === 'string' &&
    typeof manifest.exportedAt === 'string' && Number.isInteger(manifest.eventCount) &&
    Number.isInteger(manifest.attachmentCount) && Array.isArray(manifest.attachments)
}

export class FullBackupService {
  private readonly excelBackup: BackupService

  constructor(
    private readonly events: EventRepository = eventRepository,
    private readonly attachments: AttachmentRepository = attachmentRepository,
  ) {
    this.excelBackup = new BackupService(events, undefined, undefined, attachments)
  }

  async exportBackup(): Promise<Uint8Array> {
    const [events, attachments, workbook] = await Promise.all([
      this.events.getAll(),
      this.attachments.getAll(),
      this.excelBackup.exportWorkbook(),
    ])
    this.validateAttachmentLimits(attachments)

    const zipEntries: Record<string, Uint8Array> = { 'Daily.xlsx': workbook }
    const manifestAttachments: ManifestAttachment[] = []

    for (const attachment of attachments) {
      if (!attachment.blob) throw new Error(`${attachment.filename} 缺少實際檔案內容，無法建立完整備份。`)
      const path = toZipPath(attachment)
      zipEntries[path] = new Uint8Array(await attachment.blob.arrayBuffer())
      manifestAttachments.push({
        id: attachment.id,
        eventId: attachment.eventId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
        type: attachment.type,
        createdAt: attachment.createdAt,
        path,
      })
    }

    const manifest: BackupManifest = {
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      eventCount: events.length,
      attachmentCount: attachments.length,
      attachments: manifestAttachments,
    }
    zipEntries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
    return zipSync(zipEntries, { level: 6 })
  }

  async restoreBackup(data: ArrayBuffer | Uint8Array): Promise<RestoreResult> {
    const { events, attachments: restoredAttachments } = await this.readBackup(data)
    const [previousEvents, previousAttachments] = await Promise.all([this.events.getAll(), this.attachments.getAll()])
    try {
      await this.events.replaceAll(events)
      await this.attachments.replaceAll(restoredAttachments)
    } catch (error) {
      await this.rollback(previousEvents, previousAttachments)
      throw error
    }

    return { eventCount: events.length, attachmentCount: restoredAttachments.length }
  }

  async mergeBackup(data: ArrayBuffer | Uint8Array): Promise<MergeRestoreResult> {
    const imported = await this.readBackup(data)
    const [previousEvents, previousAttachments] = await Promise.all([this.events.getAll(), this.attachments.getAll()])
    const mergedEvents = previousEvents.map((event) => ({ ...event, tags: [...event.tags], attachmentIds: [...event.attachmentIds] }))
    const mergedAttachments = [...previousAttachments]
    const eventsById = new Map(mergedEvents.map((event) => [event.id, event]))
    const eventsByFingerprint = new Map(mergedEvents.map((event) => [eventFingerprint(event), event]))
    const attachmentIds = new Set(mergedAttachments.map(({ id }) => id))
    let addedEvents = 0
    let skippedEvents = 0
    let addedAttachments = 0
    let skippedAttachments = 0

    for (const importedEvent of imported.events) {
      let target = eventsById.get(importedEvent.id) ?? eventsByFingerprint.get(eventFingerprint(importedEvent))
      if (target) {
        skippedEvents += 1
      } else {
        let id = importedEvent.id
        let suffix = 2
        while (eventsById.has(id)) id = `${importedEvent.id}-import-${suffix++}`
        target = { ...importedEvent, id, tags: [...importedEvent.tags], attachmentIds: [] }
        mergedEvents.push(target)
        eventsById.set(id, target)
        eventsByFingerprint.set(eventFingerprint(target), target)
        addedEvents += 1
      }

      const importedAttachments = imported.attachments.filter(({ eventId }) => eventId === importedEvent.id)
      for (const attachment of importedAttachments) {
        const duplicate = mergedAttachments.some((item) => item.eventId === target.id &&
          item.filename === attachment.filename && item.mimeType === attachment.mimeType && item.size === attachment.size)
        if (duplicate) {
          skippedAttachments += 1
          continue
        }
        let id = attachment.id
        let suffix = 2
        while (attachmentIds.has(id)) id = `${attachment.id}-import-${suffix++}`
        const addition = { ...attachment, id, eventId: target.id }
        mergedAttachments.push(addition)
        attachmentIds.add(id)
        target.attachmentIds.push(id)
        addedAttachments += 1
      }
    }

    this.validateAttachmentLimits(mergedAttachments)
    try {
      await this.events.replaceAll(mergedEvents)
      await this.attachments.replaceAll(mergedAttachments)
    } catch (error) {
      await this.rollback(previousEvents, previousAttachments)
      throw error
    }

    return {
      addedEvents, skippedEvents, addedAttachments, skippedAttachments,
      eventCount: mergedEvents.length, attachmentCount: mergedAttachments.length,
    }
  }

  private async readBackup(data: ArrayBuffer | Uint8Array): Promise<ParsedBackup> {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    let files: Record<string, Uint8Array>
    try {
      files = unzipSync(bytes)
    } catch {
      throw new Error('完整備份 ZIP 已損壞或無法讀取。')
    }

    Object.keys(files).forEach((path) => {
      if (!isSafePath(path)) throw new Error(`ZIP 包含不安全的路徑：${path}`)
    })
    if (!files['Daily.xlsx'] || !files['manifest.json']) throw new Error('ZIP 缺少 Daily.xlsx 或 manifest.json。')
    if (files['Daily.xlsx'].byteLength > MAX_WORKBOOK_SIZE) throw new Error('Daily.xlsx 超過允許大小。')
    if (files['manifest.json'].byteLength > 1024 * 1024) throw new Error('manifest.json 超過允許大小。')

    let parsedManifest: unknown
    try {
      parsedManifest = JSON.parse(strFromU8(files['manifest.json']))
    } catch {
      throw new Error('manifest.json 已損壞。')
    }
    if (!isManifest(parsedManifest)) throw new Error('不支援或無效的完整備份 manifest。')
    const manifest = parsedManifest
    if (manifest.attachmentCount !== manifest.attachments.length || manifest.attachmentCount > MAX_ATTACHMENTS) {
      throw new Error('附件數量無效或超過上限。')
    }

    const events = await this.excelBackup.readWorkbook(files['Daily.xlsx'])
    if (events.length !== manifest.eventCount) throw new Error('事件數量與 manifest 不一致。')
    const eventIds = new Set(events.map(({ id }) => id))
    const attachmentIds = new Set<string>()
    const restoredAttachments: Attachment[] = manifest.attachments.map((item) => {
      if (!item || typeof item.id !== 'string' || typeof item.eventId !== 'string' ||
        typeof item.filename !== 'string' || typeof item.mimeType !== 'string' ||
        typeof item.size !== 'number' || !Number.isFinite(item.size) || item.size < 0 ||
        !['image', 'pdf', 'file'].includes(item.type) || typeof item.createdAt !== 'string' ||
        typeof item.path !== 'string' || !isSafePath(item.path) || !item.path.startsWith('attachments/')) {
        throw new Error('manifest 包含無效的附件 metadata。')
      }
      if (attachmentIds.has(item.id)) throw new Error(`manifest 包含重複附件 ID：${item.id}`)
      attachmentIds.add(item.id)
      if (!eventIds.has(item.eventId)) throw new Error(`${item.filename} 對應的事件不存在。`)
      const file = files[item.path]
      if (!file) throw new Error(`ZIP 缺少附件：${item.path}`)
      if (item.size > MAX_ATTACHMENT_SIZE || file.byteLength !== item.size) throw new Error(`${item.filename} 的檔案大小無效。`)
      const blobBytes = new Uint8Array(file.byteLength)
      blobBytes.set(file)
      return { ...item, path: '', blob: new Blob([blobBytes.buffer], { type: item.mimeType }) }
    })
    this.validateAttachmentLimits(restoredAttachments)

    const manifestPaths = new Set(['Daily.xlsx', 'manifest.json', ...manifest.attachments.map(({ path }) => path)])
    const unexpected = Object.keys(files).find((path) => !manifestPaths.has(path))
    if (unexpected) throw new Error(`ZIP 包含未列於 manifest 的檔案：${unexpected}`)

    events.forEach((event) => {
      const expected = restoredAttachments.filter(({ eventId }) => eventId === event.id).map(({ id }) => id).sort()
      if (event.attachmentIds.slice().sort().join('\0') !== expected.join('\0')) {
        throw new Error(`事件 ${event.id} 的附件清單與 manifest 不一致。`)
      }
    })

    return { events, attachments: restoredAttachments }
  }

  private async rollback(events: Event[], attachments: Attachment[]): Promise<void> {
    try {
      await this.events.replaceAll(events)
      await this.attachments.replaceAll(attachments)
    } catch {
      throw new Error('還原失敗，且無法完整回復原有資料。')
    }
  }

  private validateAttachmentLimits(attachments: Attachment[]): void {
    if (attachments.length > MAX_ATTACHMENTS) throw new Error(`附件數量超過 ${MAX_ATTACHMENTS} 個上限。`)
    let totalSize = 0
    attachments.forEach((attachment) => {
      if (attachment.size > MAX_ATTACHMENT_SIZE) throw new Error(`${attachment.filename} 超過 10 MB 上限。`)
      totalSize += attachment.size
    })
    if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) throw new Error('附件總大小超過 500 MB 上限。')
  }
}

export const fullBackupService = new FullBackupService()
