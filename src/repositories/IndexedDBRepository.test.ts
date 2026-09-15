import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createTestEvent } from '../test/createTestEvent'
import { IndexedDBRepository } from './IndexedDBRepository'

const createRepository = () =>
  new IndexedDBRepository(`daily-ai-test-${crypto.randomUUID()}`, [])

describe('IndexedDBRepository', () => {
  it('starts with no default events', async () => {
    const repository = new IndexedDBRepository(`daily-ai-empty-default-${crypto.randomUUID()}`)
    await expect(repository.getAll()).resolves.toEqual([])
  })

  it('creates, reads, updates, and deletes an event', async () => {
    const repository = createRepository()
    const event = createTestEvent()

    expect(await repository.getAll()).toEqual([])
    await expect(repository.add(event)).resolves.toEqual(event)
    await expect(repository.getById(event.id)).resolves.toEqual(event)

    const updated = {
      ...event,
      title: '更新後事件',
      tags: ['更新'],
      updatedAt: '2026-07-27T09:00:00.000Z',
    }
    await expect(repository.update(event.id, updated)).resolves.toEqual(updated)
    await expect(repository.getAll()).resolves.toEqual([updated])

    await repository.delete(event.id)
    await expect(repository.getById(event.id)).resolves.toBeUndefined()
    await expect(repository.getAll()).resolves.toEqual([])
  })

  it('atomically replaces all events', async () => {
    const repository = createRepository()
    await repository.add(createTestEvent())

    const replacements = [
      createTestEvent({ id: 'replacement-1', title: '第一筆' }),
      createTestEvent({ id: 'replacement-2', title: '第二筆' }),
    ]
    await repository.replaceAll(replacements)

    await expect(repository.getAll()).resolves.toEqual(replacements)
  })

  it('rejects an update for an unknown event', async () => {
    const repository = createRepository()
    await expect(repository.update('missing', createTestEvent())).rejects.toThrow('Event not found: missing')
  })

  it('filters by keyword, category, and inclusive date range', async () => {
    const repository = createRepository()
    await repository.replaceAll([
      createTestEvent({ id: 'work-1', date: '2026-07-20', title: 'Dell EVT 會議', detail: '討論時程', category: 'work', tags: ['Dell'] }),
      createTestEvent({ id: 'travel-1', date: '2026-07-22', title: '九州旅行', detail: '去了福岡', category: 'travel', tags: ['日本'] }),
      createTestEvent({ id: 'finance-1', date: '2026-07-25', title: '所得稅', detail: '完成報稅', category: 'finance', tags: ['國稅局'] }),
    ])

    await expect(repository.search({ keyword: '福岡' })).resolves.toMatchObject([{ id: 'travel-1' }])
    await expect(repository.search({ keyword: '國稅局' })).resolves.toMatchObject([{ id: 'finance-1' }])
    await expect(repository.search({ category: 'work' })).resolves.toMatchObject([{ id: 'work-1' }])
    await expect(repository.search({ tag: '日本' })).resolves.toMatchObject([{ id: 'travel-1' }])
    await expect(repository.search({ dateFrom: '2026-07-22', dateTo: '2026-07-25' })).resolves.toHaveLength(2)
    await expect(repository.search({ keyword: '旅行', category: 'travel', tag: '日本', dateFrom: '2026-07-22', dateTo: '2026-07-22' })).resolves.toMatchObject([{ id: 'travel-1' }])
    await expect(repository.search({ category: 'work', tag: '日本' })).resolves.toEqual([])
  })
})
