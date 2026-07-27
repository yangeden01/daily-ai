import { IndexedDBRepository } from './IndexedDBRepository'
import type { EventRepository } from './EventRepository'

export const eventRepository: EventRepository = new IndexedDBRepository()
