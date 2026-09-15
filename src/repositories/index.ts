import { IndexedDBRepository } from './IndexedDBRepository'
import type { EventRepository } from './EventRepository'
import { IndexedDBAttachmentRepository } from './IndexedDBAttachmentRepository'
import type { AttachmentRepository } from './AttachmentRepository'

export const eventRepository: EventRepository = new IndexedDBRepository()
export const attachmentRepository: AttachmentRepository = new IndexedDBAttachmentRepository()
