import type { Attachment } from '../models/Attachment'

export interface AttachmentRepository {
  getByEventId(eventId: string): Promise<Attachment[]>
  addMany(attachments: Attachment[]): Promise<Attachment[]>
  delete(id: string): Promise<void>
  deleteByEventId(eventId: string): Promise<void>
}
