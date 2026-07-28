import type { Event } from './Event'
import type { EventSearchCriteria } from './EventSearchCriteria'

export type EventQueryOperation = 'list' | 'count' | 'sum' | 'related'

export interface ParsedEventQuery {
  rawText: string
  operation: EventQueryOperation
  criteria: EventSearchCriteria
  dateLabel?: string
}

export interface EventQueryResult {
  query: ParsedEventQuery
  events: Event[]
  count: number
  amountTotal: number
}
