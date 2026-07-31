import { describe, expect, it } from 'vitest'
import type { Event } from '../models/Event'
import { isDailyEvent, isNoteEvent, sortNotes } from './noteEvents'

const makeEvent = (overrides: Partial<Event>): Event => ({
  id: 'event', date: '', title: 'Note', detail: 'Detail', category: '私事', tags: [], attachmentIds: [],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...overrides,
})

describe('noteEvents', () => {
  it('treats legacy records without recordType as Daily', () => {
    const legacy = makeEvent({ date: '2026-01-01' })
    expect(isDailyEvent(legacy)).toBe(true)
    expect(isNoteEvent(legacy)).toBe(false)
  })

  it('sorts notes by latest edit', () => {
    const older = makeEvent({ id: 'older', recordType: 'note', lastEditedAt: '2026-01-01T00:00:00.000Z' })
    const newer = makeEvent({ id: 'newer', recordType: 'note', lastEditedAt: '2026-02-01T00:00:00.000Z' })
    expect(sortNotes([older, newer], 'recent').map(({ id }) => id)).toEqual(['newer', 'older'])
  })

  it('sorts frequent notes by update count and then edit time', () => {
    const frequent = makeEvent({ id: 'frequent', recordType: 'note', updateCount: 5 })
    const recent = makeEvent({ id: 'recent', recordType: 'note', updateCount: 2, lastEditedAt: '2026-02-01T00:00:00.000Z' })
    expect(sortNotes([recent, frequent], 'frequent').map(({ id }) => id)).toEqual(['frequent', 'recent'])
  })
})
