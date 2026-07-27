import { describe, expect, it } from 'vitest'
import { createTestEvent } from '../test/createTestEvent'
import { calculateEventStatistics } from './calculateEventStatistics'

describe('calculateEventStatistics', () => {
  it('calculates selected-month totals, category counts, and six-month history', () => {
    const statistics = calculateEventStatistics([
      createTestEvent({ id: '1', date: '2026-07-01', category: 'work', amount: 1200 }),
      createTestEvent({ id: '2', date: '2026-07-20', category: 'work', amount: undefined }),
      createTestEvent({ id: '3', date: '2026-07-25', category: 'finance', amount: 300 }),
      createTestEvent({ id: '4', date: '2026-06-10', category: 'travel', amount: 9000 }),
      createTestEvent({ id: '5', date: '2026-02-10', category: 'life' }),
      createTestEvent({ id: '6', date: '2026-01-10', category: 'life' }),
    ], '2026-07')

    expect(statistics.eventCount).toBe(3)
    expect(statistics.amountTotal).toBe(1500)
    expect(statistics.categories).toEqual([
      { category: 'work', count: 2 },
      { category: 'finance', count: 1 },
    ])
    expect(statistics.recentMonths).toEqual([
      { month: '2026-02', count: 1 },
      { month: '2026-03', count: 0 },
      { month: '2026-04', count: 0 },
      { month: '2026-05', count: 0 },
      { month: '2026-06', count: 1 },
      { month: '2026-07', count: 3 },
    ])
  })

  it('returns zero totals and empty categories when the month has no events', () => {
    const statistics = calculateEventStatistics([], '2026-07')

    expect(statistics.eventCount).toBe(0)
    expect(statistics.amountTotal).toBe(0)
    expect(statistics.categories).toEqual([])
    expect(statistics.recentMonths).toHaveLength(6)
    expect(statistics.recentMonths.every(({ count }) => count === 0)).toBe(true)
  })
})
