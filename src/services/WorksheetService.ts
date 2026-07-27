import type ExcelJS from 'exceljs'

export const worksheetNames = {
  events: 'Events',
  tags: 'Tags',
  attachments: 'Attachments',
  settings: 'Settings',
} as const

const worksheetColumns: Record<string, Partial<ExcelJS.Column>[]> = {
  [worksheetNames.events]: [
    { header: 'id', key: 'id', width: 24 },
    { header: 'date', key: 'date', width: 14 },
    { header: 'title', key: 'title', width: 32 },
    { header: 'detail', key: 'detail', width: 48 },
    { header: 'category', key: 'category', width: 16 },
    { header: 'amount', key: 'amount', width: 14 },
    { header: 'tags', key: 'tags', width: 28 },
    { header: 'attachmentIds', key: 'attachmentIds', width: 28 },
    { header: 'createdAt', key: 'createdAt', width: 28 },
    { header: 'updatedAt', key: 'updatedAt', width: 28 },
  ],
  [worksheetNames.tags]: [
    { header: 'id', key: 'id', width: 24 },
    { header: 'eventId', key: 'eventId', width: 24 },
    { header: 'name', key: 'name', width: 24 },
  ],
  [worksheetNames.attachments]: [
    { header: 'id', key: 'id', width: 24 },
    { header: 'eventId', key: 'eventId', width: 24 },
    { header: 'filename', key: 'filename', width: 32 },
    { header: 'path', key: 'path', width: 48 },
    { header: 'type', key: 'type', width: 14 },
    { header: 'mimeType', key: 'mimeType', width: 28 },
    { header: 'size', key: 'size', width: 14 },
    { header: 'createdAt', key: 'createdAt', width: 28 },
  ],
  [worksheetNames.settings]: [
    { header: 'key', key: 'key', width: 28 },
    { header: 'value', key: 'value', width: 48 },
  ],
}

export class WorksheetService {
  createWorksheets(workbook: ExcelJS.Workbook): void {
    Object.values(worksheetNames).forEach((name) => {
      this.createWorksheet(workbook, name)
    })
  }

  getEventsWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
    return this.createWorksheet(workbook, worksheetNames.events)
  }

  getTagsWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
    return this.createWorksheet(workbook, worksheetNames.tags)
  }

  getAttachmentsWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
    return this.createWorksheet(workbook, worksheetNames.attachments)
  }

  getSettingsWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
    return this.createWorksheet(workbook, worksheetNames.settings)
  }

  private createWorksheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
    const existing = workbook.getWorksheet(name)
    if (existing) return existing

    const worksheet = workbook.addWorksheet(name, {
      views: [{ state: 'frozen', ySplit: 1 }],
    })
    worksheet.columns = worksheetColumns[name]
    worksheet.getRow(1).font = { bold: true }
    return worksheet
  }
}
