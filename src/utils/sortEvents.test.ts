import { describe, expect, it } from 'vitest'
import { createTestEvent } from '../test/createTestEvent'
import { sortEventsNewestFirst } from './sortEvents'

describe('sortEventsNewestFirst', () => {
  it('sorts by date and compares same-day timestamps across time zones', () => {
    const events = [
      createTestEvent({ id: 'older-date', date: '2026-07-26', createdAt: '2026-07-26T23:00:00Z' }),
      createTestEvent({ id: 'older-time', createdAt: '2026-07-27T09:30:00+08:00' }),
      createTestEvent({ id: 'newer-time', createdAt: '2026-07-27T08:15:00Z' }),
    ]

    expect(sortEventsNewestFirst(events).map(({ id }) => id)).toEqual(['newer-time', 'older-time', 'older-date'])
  })
})
