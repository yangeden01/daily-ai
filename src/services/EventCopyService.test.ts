import { describe, expect, it, vi } from 'vitest'
import type { Attachment } from '../models/Attachment'
import type { Event } from '../models/Event'
import type { AttachmentRepository } from '../repositories/AttachmentRepository'
import type { EventRepository } from '../repositories/EventRepository'
import { copyEventWithAttachments } from './EventCopyService'

const source: Event = {
  id: 'note-1', date: '', title: '出差清單', detail: '護照', category: '旅行', amount: 100,
  tags: ['出差'], attachmentIds: ['file-1'], createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z', recordType: 'note', updateCount: 8,
  lastEditedAt: '2026-01-02T00:00:00.000Z',
}
const sourceAttachment: Attachment = {
  id: 'file-1', eventId: source.id, filename: 'list.pdf', path: '', type: 'pdf',
  mimeType: 'application/pdf', size: 3, blob: new Blob(['pdf']), createdAt: source.createdAt,
}

const eventRepository = (add = vi.fn(async (event: Event) => event)): EventRepository => ({
  getAll: vi.fn(), getById: vi.fn(), search: vi.fn(), add, update: vi.fn(), delete: vi.fn(), replaceAll: vi.fn(),
})
const attachmentRepository = (addMany = vi.fn(async (items: Attachment[]) => items)): AttachmentRepository => ({
  getAll: vi.fn(), getByEventId: vi.fn(), addMany, delete: vi.fn(), deleteByEventId: vi.fn(), replaceAll: vi.fn(),
})

describe('copyEventWithAttachments', () => {
  it('creates an independent note and attachment IDs while preserving content', async () => {
    const events = eventRepository()
    const attachments = attachmentRepository()
    const copied = await copyEventWithAttachments(source, [sourceAttachment], events, attachments)

    expect(copied.id).not.toBe(source.id)
    expect(copied).toMatchObject({ title: source.title, detail: source.detail, category: source.category, recordType: 'note', updateCount: 0 })
    expect(copied.tags).toEqual(source.tags)
    expect(copied.attachmentIds).toHaveLength(1)
    expect(copied.attachmentIds[0]).not.toBe(sourceAttachment.id)
    expect(vi.mocked(attachments.addMany).mock.calls[0][0][0]).toMatchObject({ eventId: copied.id, filename: sourceAttachment.filename, blob: sourceAttachment.blob })
  })

  it('removes the copied event when attachment copying fails', async () => {
    const events = eventRepository()
    const attachments = attachmentRepository(vi.fn(async () => { throw new Error('failed') }))
    await expect(copyEventWithAttachments(source, [sourceAttachment], events, attachments)).rejects.toThrow('failed')
    expect(events.delete).toHaveBeenCalledOnce()
  })
})
