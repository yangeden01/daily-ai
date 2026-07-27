import type { Event } from '../models/Event'
import { mockEvents } from '../mock/events'
import type { EventRepository } from './EventRepository'

const copyEvent = (event: Event): Event => ({
  ...event,
  tags: [...event.tags],
  attachmentIds: [...event.attachmentIds],
})

export class MockEventRepository implements EventRepository {
  private events: Event[] = mockEvents.map(copyEvent)

  async getAll(): Promise<Event[]> {
    return this.events.map(copyEvent)
  }

  async getById(id: string): Promise<Event | undefined> {
    const event = this.events.find((item) => item.id === id)
    return event ? copyEvent(event) : undefined
  }

  async add(event: Event): Promise<Event> {
    const nextEvent = copyEvent(event)
    this.events.push(nextEvent)
    return copyEvent(nextEvent)
  }

  async update(id: string, event: Event): Promise<Event> {
    const index = this.events.findIndex((item) => item.id === id)

    if (index === -1) {
      throw new Error(`Event not found: ${id}`)
    }

    const updatedEvent = copyEvent({ ...event, id })
    this.events[index] = updatedEvent
    return copyEvent(updatedEvent)
  }

  async delete(id: string): Promise<void> {
    this.events = this.events.filter((event) => event.id !== id)
  }

  async replaceAll(events: Event[]): Promise<void> {
    this.events = events.map(copyEvent)
  }
}
