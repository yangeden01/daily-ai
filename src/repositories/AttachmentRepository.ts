import type { Attachment } from '../models/Attachment'

export interface AttachmentRepository {
  getAll(): Promise<Attachment[]>
  getByEventId(eventId: string): Promise<Attachment[]>
  addMany(attachments: Attachment[]): Promise<Attachment[]>
  delete(id: string): Promise<void>
  deleteByEventId(eventId: string): Promise<void>
  replaceAll(attachments: Attachment[]): Promise<void>
}
