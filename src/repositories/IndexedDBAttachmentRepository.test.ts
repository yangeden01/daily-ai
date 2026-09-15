import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { Attachment } from '../models/Attachment'
import { IndexedDBAttachmentRepository } from './IndexedDBAttachmentRepository'

const attachment = (overrides: Partial<Attachment> = {}): Attachment => ({
  id: crypto.randomUUID(), eventId: 'event-1', filename: 'photo.jpg', path: '', type: 'image',
  mimeType: 'image/jpeg', size: 3, blob: new Blob(['abc']), createdAt: '2026-07-27T00:00:00.000Z', ...overrides,
})

describe('IndexedDBAttachmentRepository', () => {
  it('stores blobs, reads by event, and deletes individual attachments', async () => {
    const repository = new IndexedDBAttachmentRepository(`attachment-test-${crypto.randomUUID()}`)
    const photo = attachment()
    const file = attachment({ id: crypto.randomUUID(), filename: 'note.pdf', type: 'pdf' })
    await repository.addMany([photo, file])
    expect(await repository.getByEventId('event-1')).toHaveLength(2)
    await repository.delete(photo.id)
    await expect(repository.getByEventId('event-1')).resolves.toMatchObject([{ id: file.id }])
  })

  it('deletes every attachment belonging to an event', async () => {
    const repository = new IndexedDBAttachmentRepository(`attachment-test-${crypto.randomUUID()}`)
    await repository.addMany([attachment(), attachment(), attachment({ eventId: 'event-2' })])
    await repository.deleteByEventId('event-1')
    await expect(repository.getByEventId('event-1')).resolves.toEqual([])
    await expect(repository.getByEventId('event-2')).resolves.toHaveLength(1)
  })

  it('atomically replaces all attachments', async () => {
    const repository = new IndexedDBAttachmentRepository(`attachment-test-${crypto.randomUUID()}`)
    await repository.addMany([attachment()])
    const replacement = attachment({ id: 'replacement', eventId: 'event-2' })
    await repository.replaceAll([replacement])
    await expect(repository.getAll()).resolves.toMatchObject([{ id: 'replacement' }])
  })
})
