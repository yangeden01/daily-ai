import type ExcelJS from 'exceljs'
import type { Event } from '../models/Event'
import type { EventSearchCriteria } from '../models/EventSearchCriteria'
import { oneDriveService, type OneDriveService } from '../services/OneDriveService'
import { WorkbookService } from '../services/WorkbookService'
import { WorksheetService } from '../services/WorksheetService'
import { filterEvents } from '../utils/filterEvents'
import type { EventRepository } from './EventRepository'

type EventRow = {
  id: string
  date: string
  title: string
  detail: string
  category: string
  amount: number | null
  tags: string
  attachmentIds: string
  createdAt: string
  updatedAt: string
  recordType: 'daily' | 'note'
  updateCount: number
  lastEditedAt: string
}

export class ExcelRepository implements EventRepository {
  private workbookPromise: Promise<ExcelJS.Workbook> | null = null

  constructor(
    private readonly oneDrive: OneDriveService = oneDriveService,
    private readonly workbookService = new WorkbookService(),
    private readonly worksheetService = new WorksheetService(),
  ) {}

  async getAll(): Promise<Event[]> {
    const worksheet = await this.getEventsWorksheet()
    const events: Event[] = []

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && this.cellText(row, 1)) events.push(this.rowToEvent(row))
    })

    return events
  }

  async getById(id: string): Promise<Event | undefined> {
    const worksheet = await this.getEventsWorksheet()
    const row = this.findRow(worksheet, id)
    return row ? this.rowToEvent(row) : undefined
  }

  async search(criteria: EventSearchCriteria): Promise<Event[]> {
    return filterEvents(await this.getAll(), criteria)
  }

  async add(event: Event): Promise<Event> {
    const workbook = await this.getWorkbook()
    const worksheet = this.worksheetService.getEventsWorksheet(workbook)

    if (this.findRow(worksheet, event.id)) {
      throw new Error(`Event already exists: ${event.id}`)
    }

    worksheet.addRow(this.eventToRow(event))
    this.syncTags(workbook, event)
    await this.persistAndReload(workbook)
    return this.copyEvent(event)
  }

  async update(id: string, event: Event): Promise<Event> {
    const workbook = await this.getWorkbook()
    const worksheet = this.worksheetService.getEventsWorksheet(workbook)
    const row = this.findRow(worksheet, id)

    if (!row) throw new Error(`Event not found: ${id}`)

    const updatedEvent = { ...event, id }
    row.values = this.rowValues(this.eventToRow(updatedEvent))
    this.syncTags(workbook, updatedEvent)
    await this.persistAndReload(workbook)
    return this.copyEvent(updatedEvent)
  }

  async delete(id: string): Promise<void> {
    const workbook = await this.getWorkbook()
    const worksheet = this.worksheetService.getEventsWorksheet(workbook)
    const row = this.findRow(worksheet, id)

    if (row) {
      worksheet.spliceRows(row.number, 1)
      this.removeTags(workbook, id)
      await this.persistAndReload(workbook)
    }
  }

  async replaceAll(events: Event[]): Promise<void> {
    const workbook = await this.getWorkbook()
    const eventsWorksheet = this.worksheetService.getEventsWorksheet(workbook)
    const tagsWorksheet = this.worksheetService.getTagsWorksheet(workbook)

    if (eventsWorksheet.rowCount > 1) {
      eventsWorksheet.spliceRows(2, eventsWorksheet.rowCount - 1)
    }
    if (tagsWorksheet.rowCount > 1) {
      tagsWorksheet.spliceRows(2, tagsWorksheet.rowCount - 1)
    }

    events.forEach((event) => {
      eventsWorksheet.addRow(this.eventToRow(event))
      this.syncTags(workbook, event)
    })

    await this.persistAndReload(workbook)
  }

  async save(): Promise<Uint8Array> {
    return this.workbookService.saveWorkbook(await this.getWorkbook())
  }

  private getWorkbook(): Promise<ExcelJS.Workbook> {
    if (!this.workbookPromise) this.workbookPromise = this.loadWorkbook()
    return this.workbookPromise
  }

  private async loadWorkbook(): Promise<ExcelJS.Workbook> {
    const data = await this.oneDrive.readWorkbook()
    const workbook = data
      ? await this.workbookService.openWorkbook(data)
      : this.workbookService.createWorkbook()

    this.worksheetService.createWorksheets(workbook)

    if (!data) {
      await this.oneDrive.writeWorkbook(await this.workbookService.saveWorkbook(workbook))
    }

    return workbook
  }

  private async persistAndReload(workbook: ExcelJS.Workbook): Promise<void> {
    await this.oneDrive.writeWorkbook(await this.workbookService.saveWorkbook(workbook))
    const savedData = await this.oneDrive.readWorkbook()
    if (!savedData) throw new Error('Daily.xlsx could not be reloaded after saving')

    const reloadedWorkbook = await this.workbookService.openWorkbook(savedData)
    this.worksheetService.createWorksheets(reloadedWorkbook)
    this.workbookPromise = Promise.resolve(reloadedWorkbook)
  }

  private async getEventsWorksheet(): Promise<ExcelJS.Worksheet> {
    return this.worksheetService.getEventsWorksheet(await this.getWorkbook())
  }

  private syncTags(workbook: ExcelJS.Workbook, event: Event): void {
    this.removeTags(workbook, event.id)
    const worksheet = this.worksheetService.getTagsWorksheet(workbook)
    event.tags.forEach((name, index) => {
      worksheet.addRow({
        id: `${event.id}:tag:${index + 1}`,
        eventId: event.id,
        name,
      })
    })
  }

  private removeTags(workbook: ExcelJS.Workbook, eventId: string): void {
    const worksheet = this.worksheetService.getTagsWorksheet(workbook)
    for (let rowNumber = worksheet.rowCount; rowNumber > 1; rowNumber -= 1) {
      if (this.cellText(worksheet.getRow(rowNumber), 2) === eventId) {
        worksheet.spliceRows(rowNumber, 1)
      }
    }
  }

  private findRow(worksheet: ExcelJS.Worksheet, id: string): ExcelJS.Row | undefined {
    let matchedRow: ExcelJS.Row | undefined
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && this.cellText(row, 1) === id) matchedRow = row
    })
    return matchedRow
  }

  private eventToRow(event: Event): EventRow {
    return {
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
      recordType: event.recordType ?? 'daily',
      updateCount: event.updateCount ?? 0,
      lastEditedAt: event.lastEditedAt ?? event.updatedAt,
    }
  }

  private rowToEvent(row: ExcelJS.Row): Event {
    const amount = row.getCell(6).value
    return {
      id: this.cellText(row, 1),
      date: this.cellText(row, 2),
      title: this.cellText(row, 3),
      detail: this.cellText(row, 4),
      category: this.cellText(row, 5),
      ...(typeof amount === 'number' ? { amount } : {}),
      tags: this.parseStringArray(this.cellText(row, 7)),
      attachmentIds: this.parseStringArray(this.cellText(row, 8)),
      createdAt: this.cellText(row, 9),
      updatedAt: this.cellText(row, 10),
      ...(this.cellText(row, 11) === 'note' ? { recordType: 'note' as const } : {}),
      ...(this.cellText(row, 11) === 'note' ? {
        updateCount: Number(this.cellText(row, 12)) || 0,
        lastEditedAt: this.cellText(row, 13) || this.cellText(row, 10),
      } : {}),
    }
  }

  private rowValues(row: EventRow): ExcelJS.CellValue[] {
    return [null, row.id, row.date, row.title, row.detail, row.category, row.amount, row.tags, row.attachmentIds, row.createdAt, row.updatedAt, row.recordType, row.updateCount, row.lastEditedAt]
  }

  private cellText(row: ExcelJS.Row, column: number): string {
    return row.getCell(column).text
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

  private copyEvent(event: Event): Event {
    return { ...event, tags: [...event.tags], attachmentIds: [...event.attachmentIds] }
  }
}
