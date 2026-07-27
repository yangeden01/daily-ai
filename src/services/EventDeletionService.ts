import type { Event } from '../models/Event'
import { attachmentRepository, eventRepository } from '../repositories'
import type { AttachmentRepository } from '../repositories/AttachmentRepository'
import type { EventRepository } from '../repositories/EventRepository'

export const deleteEventWithAttachments = async (
  event: Event,
  events: EventRepository = eventRepository,
  attachments: AttachmentRepository = attachmentRepository,
): Promise<void> => {
  const attachmentSnapshot = await attachments.getByEventId(event.id)
  await attachments.deleteByEventId(event.id)

  try {
    await events.delete(event.id)
  } catch (error) {
    await attachments.addMany(attachmentSnapshot)
    throw error
  }
}
