import type { Event } from '../models/Event'
import type { EventSearchCriteria } from '../models/EventSearchCriteria'

export interface EventRepository {
  getAll(): Promise<Event[]>
  getById(id: string): Promise<Event | undefined>
  search(criteria: EventSearchCriteria): Promise<Event[]>
  add(event: Event): Promise<Event>
  update(id: string, event: Event): Promise<Event>
  delete(id: string): Promise<void>
  replaceAll(events: Event[]): Promise<void>
}
