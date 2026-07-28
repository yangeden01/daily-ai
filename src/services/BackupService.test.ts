import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IndexedDBRepository } from '../repositories/IndexedDBRepository'
import { IndexedDBAttachmentRepository } from '../repositories/IndexedDBAttachmentRepository'
import { createTestEvent } from '../test/createTestEvent'
import { BackupService } from './BackupService'
import { WorkbookService } from './WorkbookService'
import { worksheetNames } from './WorksheetService'

const createRepository = () =>
  new IndexedDBRepository(`daily-ai-backup-test-${crypto.randomUUID()}`, [])

describe('BackupService', () => {
  it('exports all worksheets and restores events with tags', async () => {
    const source = createRepository()
    const events = [
      createTestEvent(),
      createTestEvent({
        id: 'event-002',
        title: '旅行事件',
        category: 'travel',
        amount: undefined,
        tags: ['日本', '九州'],
      }),
    ]
    await source.replaceAll(events)

    const attachments = new IndexedDBAttachmentRepository(`daily-ai-backup-attachments-${crypto.randomUUID()}`)
    await attachments.addMany([{
      id: 'attachment-1', eventId: events[0].id, filename: 'photo.jpg', path: '', type: 'image',
      mimeType: 'image/jpeg', size: 5, blob: new Blob(['photo']), createdAt: '2026-07-27T08:00:00.000Z',
    }])
    const data = await new BackupService(source, undefined, undefined, attachments).exportWorkbook()
    const workbook = await new WorkbookService().openWorkbook(data)
    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual([
      worksheetNames.events,
      worksheetNames.tags,
      worksheetNames.attachments,
      worksheetNames.settings,
    ])
    const attachmentSheet = workbook.getWorksheet(worksheetNames.attachments)
    expect(attachmentSheet?.rowCount).toBe(2)
    expect(attachmentSheet?.getRow(2).getCell(3).text).toBe('photo.jpg')
    expect(attachmentSheet?.columnCount).toBe(8)

    const target = createRepository()
    await expect(new BackupService(target).importWorkbook(data)).resolves.toBe(2)
    await expect(target.getAll()).resolves.toEqual(events)
  })

  it('rejects an unsupported schema without replacing existing data', async () => {
    const source = createRepository()
    await source.replaceAll([createTestEvent()])
    const service = new BackupService(source)
    const workbookService = new WorkbookService()
    const workbook = await workbookService.openWorkbook(await service.exportWorkbook())
    const settings = workbook.getWorksheet(worksheetNames.settings)
    if (!settings) throw new Error('Settings worksheet missing in test fixture')
    settings.getRow(2).getCell(2).value = 99

    const target = createRepository()
    const existing = createTestEvent({ id: 'existing', title: '既有資料' })
    await target.replaceAll([existing])

    await expect(
      new BackupService(target).importWorkbook(await workbookService.saveWorkbook(workbook)),
    ).rejects.toThrow('不支援的備份版本：99')
    await expect(target.getAll()).resolves.toEqual([existing])
  })

  it('migrates a legacy Record worksheet and maps privacy categories', async () => {
    const workbookService = new WorkbookService()
    const workbook = workbookService.createWorkbook()
    const record = workbook.addWorksheet('Record')
    record.addRow(['Date', '', 'Type', '', 'Record'])
    record.addRow([new Date('2026-07-14T00:00:00.000Z'), '', 'P', '', '九州旅行第五天。'])
    record.addRow([new Date('2026-07-15T00:00:00.000Z'), '', 'CP', '', '機密會議紀錄。'])

    const target = createRepository()
    const result = await new BackupService(target).mergeWorkbook(await workbookService.saveWorkbook(workbook))

    expect(result).toMatchObject({ added: 2, skipped: 0, format: 'legacy' })
    await expect(target.getAll()).resolves.toMatchObject([
      { date: '2026-07-14', title: '九州旅行第五天。', category: '私事' },
      { date: '2026-07-15', title: '機密會議紀錄。', category: '機密公事' },
    ])
  })

  it('merges new events while skipping duplicates without overwriting existing data', async () => {
    const source = createRepository()
    const duplicate = createTestEvent({ id: 'imported-duplicate' })
    const newEvent = createTestEvent({ id: 'new-event', title: '新事件', detail: '新事件內容' })
    await source.replaceAll([duplicate, newEvent])
    const data = await new BackupService(source).exportWorkbook()

    const target = createRepository()
    const existing = createTestEvent({ id: 'existing-local' })
    await target.replaceAll([existing])
    const result = await new BackupService(target).mergeWorkbook(data)

    expect(result).toEqual({ added: 1, skipped: 1, total: 2, format: 'daily-ai' })
    await expect(target.getAll()).resolves.toMatchObject([
      { id: 'existing-local', title: '測試事件' },
      { id: 'new-event', title: '新事件' },
    ])
  })
})
