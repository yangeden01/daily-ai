import type { Event } from '../models/Event'

export const sortEventsNewestFirst = (events: Event[]): Event[] =>
  [...events].sort((a, b) =>
    b.date.localeCompare(a.date) || Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )
