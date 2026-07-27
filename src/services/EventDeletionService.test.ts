import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IndexedDBAttachmentRepository } from '../repositories/IndexedDBAttachmentRepository'
import { IndexedDBRepository } from '../repositories/IndexedDBRepository'
import { createTestEvent } from '../test/createTestEvent'
import { deleteEventWithAttachments } from './EventDeletionService'

const attachment = (eventId: string) => ({
  id: 'attachment-1', eventId, filename: 'note.txt', path: '', type: 'file' as const,
  mimeType: 'text/plain', size: 4, blob: new Blob(['note']), createdAt: '2026-07-27T00:00:00Z',
})

describe('deleteEventWithAttachments', () => {
  it('deletes the event and all of its attachments', async () => {
    const event = createTestEvent({ attachmentIds: ['attachment-1'] })
    const events = new IndexedDBRepository(`delete-events-${crypto.randomUUID()}`, [])
    const attachments = new IndexedDBAttachmentRepository(`delete-attachments-${crypto.randomUUID()}`)
    await events.add(event)
    await attachments.addMany([attachment(event.id)])

    await deleteEventWithAttachments(event, events, attachments)
    await expect(events.getById(event.id)).resolves.toBeUndefined()
    await expect(attachments.getByEventId(event.id)).resolves.toEqual([])
  })

  it('restores attachments when event deletion fails', async () => {
    const event = createTestEvent({ attachmentIds: ['attachment-1'] })
    const events = new IndexedDBRepository(`delete-events-${crypto.randomUUID()}`, [])
    const attachments = new IndexedDBAttachmentRepository(`delete-attachments-${crypto.randomUUID()}`)
    events.delete = async () => { throw new Error('event delete failed') }
    await attachments.addMany([attachment(event.id)])

    await expect(deleteEventWithAttachments(event, events, attachments)).rejects.toThrow()
    await expect(attachments.getByEventId(event.id)).resolves.toHaveLength(1)
  })
})
