import type { Event } from '../models/Event'

export type NoteSort = 'recent' | 'frequent'

export const isNoteEvent = (event: Event): boolean => event.recordType === 'note'
export const isDailyEvent = (event: Event): boolean => !isNoteEvent(event)

const editedAt = (event: Event) => event.lastEditedAt ?? event.updatedAt

export const sortNotes = (events: Event[], sort: NoteSort): Event[] => [...events].sort((left, right) => {
  if (sort === 'frequent') {
    const frequency = (right.updateCount ?? 0) - (left.updateCount ?? 0)
    if (frequency !== 0) return frequency
  }
  return editedAt(right).localeCompare(editedAt(left))
})

export const noteUpdatedAt = editedAt
