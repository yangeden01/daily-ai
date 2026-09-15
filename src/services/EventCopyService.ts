import type { Attachment } from '../models/Attachment'
import type { Event } from '../models/Event'
import { attachmentRepository, eventRepository } from '../repositories'
import type { AttachmentRepository } from '../repositories/AttachmentRepository'
import type { EventRepository } from '../repositories/EventRepository'
import { isNoteEvent } from '../utils/noteEvents'

export const copyEventWithAttachments = async (
  source: Event,
  sourceAttachments: Attachment[],
  events: EventRepository = eventRepository,
  attachments: AttachmentRepository = attachmentRepository,
): Promise<Event> => {
  const timestamp = new Date().toISOString()
  const copiedEventId = crypto.randomUUID()
  const copiedAttachments = sourceAttachments.map((attachment) => ({
    ...attachment,
    id: crypto.randomUUID(),
    eventId: copiedEventId,
    createdAt: timestamp,
  }))
  const copiedEvent: Event = {
    ...source,
    id: copiedEventId,
    tags: [...source.tags],
    attachmentIds: copiedAttachments.map(({ id }) => id),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(isNoteEvent(source) ? { updateCount: 0, lastEditedAt: timestamp } : {}),
  }

  await events.add(copiedEvent)
  try {
    await attachments.addMany(copiedAttachments)
  } catch (error) {
    await Promise.all(copiedAttachments.map(({ id }) => attachments.delete(id)))
    await events.delete(copiedEventId)
    throw error
  }

  return copiedEvent
}
