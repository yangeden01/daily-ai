import type { Event } from '../models/Event'

export interface EventRepository {
  getAll(): Promise<Event[]>
  getById(id: string): Promise<Event | undefined>
  add(event: Event): Promise<Event>
  update(id: string, event: Event): Promise<Event>
  delete(id: string): Promise<void>
  replaceAll(events: Event[]): Promise<void>
}
