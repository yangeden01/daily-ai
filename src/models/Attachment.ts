export interface Attachment {
  id: string
  eventId: string
  filename: string
  path: string
  type: 'image' | 'pdf' | 'file'
  mimeType: string
  size: number
  blob?: Blob
  createdAt: string
}
