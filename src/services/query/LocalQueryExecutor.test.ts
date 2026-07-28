import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IndexedDBRepository } from '../../repositories/IndexedDBRepository'
import { createTestEvent } from '../../test/createTestEvent'
import { LocalQueryEngine } from './LocalQueryEngine'
import { LocalQueryParser } from './LocalQueryParser'

const now = new Date(2026, 6, 28, 12)

const createEngine = async () => {
  const repository = new IndexedDBRepository(`local-query-${crypto.randomUUID()}`, [])
  await repository.replaceAll([
    createTestEvent({ id: 'work-current', date: '2026-03-01', title: 'Dell EVT 會議', detail: '公事討論', category: '公事', amount: 1000, tags: ['Dell'] }),
    createTestEvent({ id: 'work-current-2', date: '2026-07-20', title: '專案例會', detail: 'Dell 時程', category: '公事', amount: undefined, tags: ['工作'] }),
    createTestEvent({ id: 'japan-last-year', date: '2025-05-02', title: '九州旅行', detail: '去了日本福岡', category: '私事', amount: 30000, tags: ['日本', '旅遊'] }),
    createTestEvent({ id: 'tax-2025', date: '2025-05-15', title: '綜合所得稅', detail: '完成報稅', category: '私事', amount: 158320, tags: ['所得稅'] }),
    createTestEvent({ id: 'secret', date: '2024-06-01', title: '日本機密專案', detail: '出差紀錄', category: '機密公事', amount: 5000, tags: ['日本'] }),
  ])
  return { repository, engine: new LocalQueryEngine(new LocalQueryParser(), repository) }
}

describe('LocalQueryEngine', () => {
  it('counts current-year work and last-year Japan events', async () => {
    const { engine } = await createEngine()
    await expect(engine.query('今年有幾筆公事？', now)).resolves.toMatchObject({ count: 2 })
    await expect(engine.query('去年去了幾次日本？', now)).resolves.toMatchObject({ count: 1 })
  })

  it('sums amount for a specified year', async () => {
    const { engine } = await createEngine()
    await expect(engine.query('2025 年所得稅總共多少？', now)).resolves.toMatchObject({ count: 1, amountTotal: 158320 })
  })

  it('searches current-month Dell events across title and detail', async () => {
    const { engine } = await createEngine()
    const result = await engine.query('這個月有哪些 Dell 事件？', now)
    expect(result?.events).toMatchObject([{ id: 'work-current-2' }])
  })

  it('combines category, tag, and date filters', async () => {
    const { engine } = await createEngine()
    const result = await engine.query('2024/01/01 到 2024/12/31 找出標籤是日本的機密公事', now)
    expect(result?.events).toMatchObject([{ id: 'secret' }])
  })

  it('returns a valid empty result without modifying repository data', async () => {
    const { repository, engine } = await createEngine()
    const before = await repository.getAll()
    await expect(engine.query('2023 年不存在的事件', now)).resolves.toMatchObject({ count: 0, amountTotal: 0, events: [] })
    await expect(repository.getAll()).resolves.toEqual(before)
  })
})
