import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IndexedDBRepository } from '../repositories/IndexedDBRepository'
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

    const data = await new BackupService(source).exportWorkbook()
    const workbook = await new WorkbookService().openWorkbook(data)
    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual([
      worksheetNames.events,
      worksheetNames.tags,
      worksheetNames.attachments,
      worksheetNames.settings,
    ])

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
})
