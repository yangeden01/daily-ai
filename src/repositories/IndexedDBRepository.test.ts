import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createTestEvent } from '../test/createTestEvent'
import { IndexedDBRepository } from './IndexedDBRepository'

const createRepository = () =>
  new IndexedDBRepository(`daily-ai-test-${crypto.randomUUID()}`, [])

describe('IndexedDBRepository', () => {
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
})
