import type ExcelJS from 'exceljs'
import type { Event } from '../models/Event'

const categoryMap: Record<string, string> = {
  P: '私事',
  C: '公事',
  CP: '機密公事',
}

const pad = (value: number) => String(value).padStart(6, '0')

const excelSerialToDate = (value: number): string => {
  const date = new Date(Math.round((value - 25569) * 86400 * 1000))
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const parseDateText = (value: string): string => {
  const normalized = value.trim().replace(/[.]/g, '/').replace(/-/g, '/')
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (match) {
    const [, year, month, day] = match
    const candidate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    const date = new Date(`${candidate}T00:00:00Z`)
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === candidate) return candidate
  }

  const usMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!usMatch) return ''
  const [, month, day, year] = usMatch
  const candidate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  const date = new Date(`${candidate}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === candidate ? candidate : ''
}

const readDate = (cell: ExcelJS.Cell): string => {
  if (cell.value instanceof Date) {
    return `${cell.value.getUTCFullYear()}-${String(cell.value.getUTCMonth() + 1).padStart(2, '0')}-${String(cell.value.getUTCDate()).padStart(2, '0')}`
  }
  if (typeof cell.value === 'number') return excelSerialToDate(cell.value)
  return parseDateText(cell.text)
}

const titleFromDetail = (detail: string): string => {
  const firstLine = detail.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? detail
  return firstLine.length <= 48 ? firstLine : `${firstLine.slice(0, 47)}…`
}

export class LegacyWorkbookMigrationService {
  canMigrate(workbook: ExcelJS.Workbook): boolean {
    const worksheet = workbook.getWorksheet('Record')
    return Boolean(worksheet && !workbook.getWorksheet('Events'))
  }

  migrate(workbook: ExcelJS.Workbook): Event[] {
    const worksheet = workbook.getWorksheet('Record')
    if (!worksheet) throw new Error('舊版 Excel 缺少 Record 工作表。')

    const events: Event[] = []
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return
      const date = readDate(row.getCell(1))
      const rawCategory = row.getCell(3).text.trim().toUpperCase().replace(/\s+/g, '')
      const detail = row.getCell(5).text.trim()
      if (!date || !detail || /^(title|record)$/i.test(detail)) return

      const timestamp = new Date(`${date}T00:00:00.000Z`).getTime() + rowNumber
      const createdAt = new Date(timestamp).toISOString()
      events.push({
        id: `legacy-record-${pad(rowNumber)}`,
        date,
        title: titleFromDetail(detail),
        detail,
        category: categoryMap[rawCategory] ?? (rawCategory || '未分類'),
        tags: [],
        attachmentIds: [],
        createdAt,
        updatedAt: createdAt,
      })
    })

    if (events.length === 0) throw new Error('Record 工作表中沒有可匯入的事件。')
    return events
  }
}
