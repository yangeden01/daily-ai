import { describe, expect, it } from 'vitest'
import type { Event } from '../models/Event'
import { isDailyEvent, isFutureDailyEvent, isNoteEvent, isTodoNote, sortNotes } from './noteEvents'

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

  it('correctly identifies todo note events', () => {
    const todoNote = makeEvent({ recordType: 'note', category: '待做事項' })
    const regularNote = makeEvent({ recordType: 'note', category: '帳密' })
    const dailyWithTodoCategory = makeEvent({ category: '待做事項' })

    expect(isTodoNote(todoNote)).toBe(true)
    expect(isTodoNote(regularNote)).toBe(false)
    expect(isTodoNote(dailyWithTodoCategory)).toBe(false)
  })

  it('correctly identifies future daily events', () => {
    const refDate = new Date(2026, 7, 27) // 2026-08-27
    const futureEvent = makeEvent({ date: '2026-09-19' })
    const todayEvent = makeEvent({ date: '2026-08-27' })
    const pastEvent = makeEvent({ date: '2026-08-23' })
    const futureNote = makeEvent({ recordType: 'note', date: '2026-09-19' })

    expect(isFutureDailyEvent(futureEvent, refDate)).toBe(true)
    expect(isFutureDailyEvent(todayEvent, refDate)).toBe(false)
    expect(isFutureDailyEvent(pastEvent, refDate)).toBe(false)
    expect(isFutureDailyEvent(futureNote, refDate)).toBe(false)
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

  it('pins 待做事項 to the top in both recent and frequent sort modes', () => {
    const normalRecent = makeEvent({ id: 'normal-recent', recordType: 'note', category: '帳密', updateCount: 10, lastEditedAt: '2026-08-28T00:00:00.000Z' })
    const todoOld = makeEvent({ id: 'todo-old', recordType: 'note', category: '待做事項', updateCount: 1, lastEditedAt: '2026-08-01T00:00:00.000Z' })
    const todoNew = makeEvent({ id: 'todo-new', recordType: 'note', category: '待做事項', updateCount: 3, lastEditedAt: '2026-08-20T00:00:00.000Z' })

    // In recent sort: todo-new, todo-old, normal-recent
    expect(sortNotes([normalRecent, todoOld, todoNew], 'recent').map(({ id }) => id)).toEqual(['todo-new', 'todo-old', 'normal-recent'])

    // In frequent sort: todo-new (count 3), todo-old (count 1), normal-recent (count 10, but not todo)
    expect(sortNotes([normalRecent, todoOld, todoNew], 'frequent').map(({ id }) => id)).toEqual(['todo-new', 'todo-old', 'normal-recent'])
  })
})
