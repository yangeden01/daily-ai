export interface Event {
  id: string
  date: string
  title: string
  detail: string
  category: string
  amount?: number
  tags: string[]
  attachmentIds: string[]
  createdAt: string
  updatedAt: string
}
