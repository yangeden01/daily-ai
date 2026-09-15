export type RecordType = 'daily' | 'note' | 'anniversary'
export type CalendarType = 'solar' | 'lunar'

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
  recordType?: RecordType
  /** Calendar system for anniversary: 'solar' (國曆) or 'lunar' (農曆) */
  calendarType?: CalendarType
  /** Lunar month (1..12) if calendarType is 'lunar' */
  lunarMonth?: number
  /** Lunar day (1..30) if calendarType is 'lunar' */
  lunarDay?: number
  /** Whether the lunar month is a leap month (閏月) */
  isLeapMonth?: boolean
  /** Initial year (e.g. birth year 1990 or marriage year 2020) for calculating age / nth anniversary */
  targetYear?: number
  /** Number of saved edits after a note was created. */
  updateCount?: number
  /** Last meaningful edit time for sorting reusable notes. */
  lastEditedAt?: string
}
