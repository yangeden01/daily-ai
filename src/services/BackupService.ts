import type ExcelJS from 'exceljs'
import type { Event } from '../models/Event'
import { attachmentRepository, eventRepository } from '../repositories'
import type { AttachmentRepository } from '../repositories/AttachmentRepository'
import type { EventRepository } from '../repositories/EventRepository'
import { WorkbookService } from './WorkbookService'
import { WorksheetService, worksheetNames } from './WorksheetService'

const BACKUP_SCHEMA_VERSION = 1

export class BackupService {
  constructor(
    private readonly repository: EventRepository = eventRepository,
    private readonly workbookService = new WorkbookService(),
    private readonly worksheetService = new WorksheetService(),
    private readonly attachments: AttachmentRepository = attachmentRepository,
  ) {}

  async exportWorkbook(): Promise<Uint8Array> {
    const events = await this.repository.getAll()
    const workbook = this.workbookService.createWorkbook()
    this.worksheetService.createWorksheets(workbook)

    const eventsWorksheet = this.worksheetService.getEventsWorksheet(workbook)
    const tagsWorksheet = this.worksheetService.getTagsWorksheet(workbook)
    const attachmentsWorksheet = this.worksheetService.getAttachmentsWorksheet(workbook)
    const settingsWorksheet = this.worksheetService.getSettingsWorksheet(workbook)

    events.forEach((event) => {
      eventsWorksheet.addRow({
        id: event.id,
        date: event.date,
        title: event.title,
        detail: event.detail,
        category: event.category,
        amount: event.amount ?? null,
        tags: JSON.stringify(event.tags),
        attachmentIds: JSON.stringify(event.attachmentIds),
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      })

      event.tags.forEach((name, index) => {
        tagsWorksheet.addRow({
          id: `${event.id}:tag:${index + 1}`,
          eventId: event.id,
          name,
        })
      })
    })

    const attachmentItems = (await Promise.all(events.map((event) => this.attachments.getByEventId(event.id)))).flat()
    attachmentItems.forEach((attachment) => {
      attachmentsWorksheet.addRow({
        id: attachment.id,
        eventId: attachment.eventId,
        filename: attachment.filename,
        path: attachment.path,
        type: attachment.type,
        mimeType: attachment.mimeType,
        size: attachment.size,
        createdAt: attachment.createdAt,
      })
    })

    settingsWorksheet.addRows([
      { key: 'schemaVersion', value: BACKUP_SCHEMA_VERSION },
      { key: 'language', value: 'zh-TW' },
      { key: 'currency', value: 'TWD' },
      { key: 'exportedAt', value: new Date().toISOString() },
    ])

    return this.workbookService.saveWorkbook(workbook)
  }

  async importWorkbook(data: ArrayBuffer | Uint8Array): Promise<number> {
    const workbook = await this.workbookService.openWorkbook(data)
    const events = this.readAndValidateEvents(workbook)
    await this.repository.replaceAll(events)
    return events.length
  }

  private readAndValidateEvents(workbook: ExcelJS.Workbook): Event[] {
    this.validateSchemaVersion(workbook)
    const worksheet = workbook.getWorksheet(worksheetNames.events)
    if (!worksheet) throw new Error('備份檔缺少 Events 工作表')

    const tagsByEvent = this.readTags(workbook)
    const events: Event[] = []
    const ids = new Set<string>()

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1 || !this.cellText(row, 1)) return

      const id = this.cellText(row, 1)
      const date = this.cellText(row, 2)
      const title = this.cellText(row, 3)
      const detail = this.cellText(row, 4)
      const category = this.cellText(row, 5)
      const createdAt = this.cellText(row, 9)
      const updatedAt = this.cellText(row, 10)

      if (!id || !date || !title || !detail || !category || !createdAt || !updatedAt) {
        throw new Error(`Events 工作表第 ${rowNumber} 列缺少必要欄位`)
      }
      if (ids.has(id)) throw new Error(`Events 工作表包含重複 ID：${id}`)
      ids.add(id)

      const amountValue = row.getCell(6).value
      const parsedAmount = typeof amountValue === 'number'
        ? amountValue
        : amountValue !== null && amountValue !== undefined && row.getCell(6).text
          ? Number(row.getCell(6).text)
          : undefined

      if (parsedAmount !== undefined && !Number.isFinite(parsedAmount)) {
        throw new Error(`Events 工作表第 ${rowNumber} 列的 amount 無效`)
      }

      events.push({
        id,
        date,
        title,
        detail,
        category,
        ...(parsedAmount !== undefined ? { amount: parsedAmount } : {}),
        tags: tagsByEvent.get(id) ?? this.parseStringArray(this.cellText(row, 7)),
        attachmentIds: this.parseStringArray(this.cellText(row, 8)),
        createdAt,
        updatedAt,
      })
    })

    return events
  }

  private validateSchemaVersion(workbook: ExcelJS.Workbook): void {
    const worksheet = workbook.getWorksheet(worksheetNames.settings)
    if (!worksheet) throw new Error('備份檔缺少 Settings 工作表')

    let schemaVersion: number | undefined
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      if (this.cellText(row, 1) !== 'schemaVersion') return
      const value = row.getCell(2).value
      schemaVersion = typeof value === 'number' ? value : Number(row.getCell(2).text)
    })

    if (schemaVersion !== BACKUP_SCHEMA_VERSION) {
      throw new Error(`不支援的備份版本：${schemaVersion ?? 'unknown'}`)
    }
  }

  private readTags(workbook: ExcelJS.Workbook): Map<string, string[]> {
    const tagsByEvent = new Map<string, string[]>()
    const worksheet = workbook.getWorksheet(worksheetNames.tags)
    if (!worksheet) return tagsByEvent

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const eventId = this.cellText(row, 2)
      const name = this.cellText(row, 3)
      if (!eventId || !name) return
      tagsByEvent.set(eventId, [...(tagsByEvent.get(eventId) ?? []), name])
    })
    return tagsByEvent
  }

  private parseStringArray(value: string): string[] {
    if (!value) return []
    try {
      const parsed: unknown = JSON.parse(value)
      return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : []
    } catch {
      return []
    }
  }

  private cellText(row: ExcelJS.Row, column: number): string {
    return row.getCell(column).text.trim()
  }
}

export const backupService = new BackupService()
