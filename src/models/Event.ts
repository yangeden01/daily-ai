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
  /** Missing on legacy rows, which are always treated as dated Daily records. */
  recordType?: 'daily' | 'note'
  /** Number of saved edits after a note was created. */
  updateCount?: number
  /** Last meaningful edit time for sorting reusable notes. */
  lastEditedAt?: string
}
