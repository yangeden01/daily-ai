export interface EventSearchCriteria {
  keyword?: string
  keywordMode?: 'all' | 'any'
  category?: string
  tag?: string
  dateFrom?: string
  dateTo?: string
  attachmentKind?: 'any' | 'photo' | 'file'
}
