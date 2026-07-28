import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { Attachment } from '../models/Attachment'
import { IndexedDBAttachmentRepository } from '../repositories/IndexedDBAttachmentRepository'
import { IndexedDBRepository } from '../repositories/IndexedDBRepository'
import { createTestEvent } from '../test/createTestEvent'
import { LocalDataService } from './LocalDataService'

const createRepositories = () => ({
  events: new IndexedDBRepository(`reset-events-${crypto.randomUUID()}`, []),
  attachments: new IndexedDBAttachmentRepository(`reset-attachments-${crypto.randomUUID()}`),
})

const attachment: Attachment = {
  id: 'attachment-1',
  eventId: 'event-1',
  filename: 'photo.jpg',
  path: '',
  type: 'image',
  mimeType: 'image/jpeg',
  size: 5,
  blob: new Blob(['photo'], { type: 'image/jpeg' }),
  createdAt: '2026-07-28T00:00:00.000Z',
}

describe('LocalDataService', () => {
  it('clears all events and attachments and reports deleted counts', async () => {
    const repositories = createRepositories()
    await repositories.events.replaceAll([
      createTestEvent({ id: 'event-1', attachmentIds: ['attachment-1'] }),
      createTestEvent({ id: 'event-2' }),
    ])
    await repositories.attachments.replaceAll([attachment])

    const result = await new LocalDataService(repositories.events, repositories.attachments).reset()

    expect(result).toEqual({ eventCount: 2, attachmentCount: 1 })
    await expect(repositories.events.getAll()).resolves.toEqual([])
    await expect(repositories.attachments.getAll()).resolves.toEqual([])
  })

  it('keeps empty databases empty', async () => {
    const repositories = createRepositories()
    await expect(new LocalDataService(repositories.events, repositories.attachments).reset())
      .resolves.toEqual({ eventCount: 0, attachmentCount: 0 })
  })
})
