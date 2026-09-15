import type { Event } from '../models/Event'
import { toLocalDateInputValue } from './localDate'

export type NoteSort = 'recent' | 'frequent'

export const isNoteEvent = (event: Event): boolean => event.recordType === 'note'
export const isAnniversaryEvent = (event: Event): boolean => event.recordType === 'anniversary'
export const isDailyEvent = (event: Event): boolean => !event.recordType || event.recordType === 'daily'

export const isTodoNote = (event: Event): boolean => {
  return isNoteEvent(event) && event.category?.trim() === '待做事項'
}

export const isFutureDailyEvent = (event: Event, referenceDate = new Date()): boolean => {
  if (!isDailyEvent(event) || !event.date) return false
  const todayYMD = toLocalDateInputValue(referenceDate)
  return event.date > todayYMD
}

const editedAt = (event: Event) => event.lastEditedAt ?? event.updatedAt

export const sortNotes = (events: Event[], sort: NoteSort): Event[] => [...events].sort((left, right) => {
  const leftTodo = left.category?.trim() === '待做事項' ? 1 : 0
  const rightTodo = right.category?.trim() === '待做事項' ? 1 : 0
  if (leftTodo !== rightTodo) {
    return rightTodo - leftTodo // 待做事項 (1) comes before normal (0)
  }

  if (sort === 'frequent') {
    const frequency = (right.updateCount ?? 0) - (left.updateCount ?? 0)
    if (frequency !== 0) return frequency
  }
  return editedAt(right).localeCompare(editedAt(left))
})

export const noteUpdatedAt = editedAt
