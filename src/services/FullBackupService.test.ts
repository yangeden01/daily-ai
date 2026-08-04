import 'fake-indexeddb/auto'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { Attachment } from '../models/Attachment'
import { IndexedDBAttachmentRepository } from '../repositories/IndexedDBAttachmentRepository'
import { IndexedDBRepository } from '../repositories/IndexedDBRepository'
import { createTestEvent } from '../test/createTestEvent'
import { FullBackupService } from './FullBackupService'

const repositories = () => ({
  events: new IndexedDBRepository(`full-backup-events-${crypto.randomUUID()}`, []),
  attachments: new IndexedDBAttachmentRepository(`full-backup-attachments-${crypto.randomUUID()}`),
})

const createAttachment = (): Attachment => ({
  id: 'attachment-1',
  eventId: 'event-1',
  filename: '旅行照片.jpg',
  path: '',
  type: 'image',
  mimeType: 'image/jpeg',
  size: 5,
  blob: new Blob(['photo'], { type: 'image/jpeg' }),
  createdAt: '2026-07-27T08:00:00.000Z',
})

describe('FullBackupService', () => {
  it('exports and restores events, metadata, and original blobs', async () => {
    const source = repositories()
    const event = createTestEvent({ id: 'event-1', attachmentIds: ['attachment-1'] })
    await source.events.replaceAll([event])
    await source.attachments.replaceAll([createAttachment()])

    const backup = await new FullBackupService(source.events, source.attachments).exportBackup()
    const files = unzipSync(backup)
    expect(files['Daily.xlsx']).toBeDefined()
    expect(files['manifest.json']).toBeDefined()
    const manifest = JSON.parse(strFromU8(files['manifest.json']))
    expect(manifest).toMatchObject({ schemaVersion: 1, appVersion: '1.0', eventCount: 1, attachmentCount: 1 })
    expect(manifest.attachments[0].path).toMatch(/^attachments\//)

    const target = repositories()
    const result = await new FullBackupService(target.events, target.attachments).restoreBackup(backup)
    expect(result).toEqual({ eventCount: 1, attachmentCount: 1 })
    await expect(target.events.getAll()).resolves.toEqual([event])
    const restored = await target.attachments.getAll()
    expect(restored).toMatchObject([{ id: 'attachment-1', filename: '旅行照片.jpg', size: 5 }])
    await expect(restored[0].blob?.text()).resolves.toBe('photo')
  })

  it('rejects a damaged manifest without overwriting existing data', async () => {
    const source = repositories()
    await source.events.replaceAll([createTestEvent({ id: 'event-1', attachmentIds: ['attachment-1'] })])
    await source.attachments.replaceAll([createAttachment()])
    const files = unzipSync(await new FullBackupService(source.events, source.attachments).exportBackup())
    const manifest = JSON.parse(strFromU8(files['manifest.json']))
    manifest.attachments[0].size = 999
    files['manifest.json'] = strToU8(JSON.stringify(manifest))

    const target = repositories()
    const existingEvent = createTestEvent({ id: 'existing', title: '不可覆蓋' })
    await target.events.replaceAll([existingEvent])
    await target.attachments.replaceAll([])

    await expect(new FullBackupService(target.events, target.attachments).restoreBackup(zipSync(files)))
      .rejects.toThrow('檔案大小無效')
    await expect(target.events.getAll()).resolves.toEqual([existingEvent])
    await expect(target.attachments.getAll()).resolves.toEqual([])
  })

  it('rejects ZIP path traversal entries', async () => {
    const unsafe = zipSync({
      'Daily.xlsx': new Uint8Array([1]),
      'manifest.json': strToU8('{}'),
      '../escape.txt': strToU8('unsafe'),
    })
    const target = repositories()
    await expect(new FullBackupService(target.events, target.attachments).restoreBackup(unsafe))
      .rejects.toThrow('不安全的路徑')
  })

  it('merges missing attachments into an existing matching event', async () => {
    const source = repositories()
    const event = createTestEvent({ id: 'event-1', attachmentIds: ['attachment-1'] })
    await source.events.replaceAll([event])
    await source.attachments.replaceAll([createAttachment()])
    const backup = await new FullBackupService(source.events, source.attachments).exportBackup()

    const target = repositories()
    await target.events.replaceAll([{ ...event, attachmentIds: [] }])
    await target.attachments.replaceAll([])
    const result = await new FullBackupService(target.events, target.attachments).mergeBackup(backup)

    expect(result).toEqual({
      addedEvents: 0,
      updatedEvents: 0,
      skippedEvents: 1,
      addedAttachments: 1,
      skippedAttachments: 0,
      eventCount: 1,
      attachmentCount: 1,
    })
    await expect(target.events.getById('event-1')).resolves.toMatchObject({ attachmentIds: ['attachment-1'] })
    await expect((await target.attachments.getAll())[0].blob?.text()).resolves.toBe('photo')
  })

  it('does not duplicate events or attachments when the same ZIP is merged twice', async () => {
    const source = repositories()
    await source.events.replaceAll([createTestEvent({ id: 'event-1', attachmentIds: ['attachment-1'] })])
    await source.attachments.replaceAll([createAttachment()])
    const backup = await new FullBackupService(source.events, source.attachments).exportBackup()
    const target = repositories()
    const service = new FullBackupService(target.events, target.attachments)

    await service.mergeBackup(backup)
    const second = await service.mergeBackup(backup)

    expect(second).toMatchObject({ addedEvents: 0, skippedEvents: 1, addedAttachments: 0, skippedAttachments: 1 })
    await expect(target.events.getAll()).resolves.toHaveLength(1)
    await expect(target.attachments.getAll()).resolves.toHaveLength(1)
  })

  it('replaces a same-ID event when the imported updatedAt is newer', async () => {
    const source = repositories()
    const importedEvent = createTestEvent({
      id: 'event-1',
      title: '手機較新的內容',
      detail: '已更新',
      updatedAt: '2026-08-04T08:00:00.000Z',
      attachmentIds: ['attachment-1'],
    })
    await source.events.replaceAll([importedEvent])
    await source.attachments.replaceAll([createAttachment()])
    const backup = await new FullBackupService(source.events, source.attachments).exportBackup()

    const target = repositories()
    await target.events.replaceAll([createTestEvent({
      id: 'event-1',
      title: '電腦較舊的內容',
      updatedAt: '2026-08-03T08:00:00.000Z',
      attachmentIds: [],
    })])
    await target.attachments.replaceAll([])

    const result = await new FullBackupService(target.events, target.attachments).mergeBackup(backup)

    expect(result).toMatchObject({ addedEvents: 0, updatedEvents: 1, skippedEvents: 0 })
    await expect(target.events.getById('event-1')).resolves.toMatchObject({
      title: '手機較新的內容',
      detail: '已更新',
      updatedAt: '2026-08-04T08:00:00.000Z',
      attachmentIds: ['attachment-1'],
    })
  })

  it('keeps a same-ID local event when the imported updatedAt is older', async () => {
    const source = repositories()
    await source.events.replaceAll([createTestEvent({
      id: 'event-1',
      title: '較舊的匯入內容',
      updatedAt: '2026-08-03T08:00:00.000Z',
    })])
    await source.attachments.replaceAll([])
    const backup = await new FullBackupService(source.events, source.attachments).exportBackup()

    const target = repositories()
    await target.events.replaceAll([createTestEvent({
      id: 'event-1',
      title: '較新的本機內容',
      updatedAt: '2026-08-04T08:00:00.000Z',
    })])
    await target.attachments.replaceAll([])

    const result = await new FullBackupService(target.events, target.attachments).mergeBackup(backup)

    expect(result).toMatchObject({ addedEvents: 0, updatedEvents: 0, skippedEvents: 1 })
    await expect(target.events.getById('event-1')).resolves.toMatchObject({
      title: '較新的本機內容',
      updatedAt: '2026-08-04T08:00:00.000Z',
    })
  })
})
