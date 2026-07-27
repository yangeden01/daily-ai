export interface Attachment {
  id: string
  eventId: string
  filename: string
  path: string
  type: 'image' | 'pdf' | 'file'
}
