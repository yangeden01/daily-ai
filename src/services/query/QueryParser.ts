import type { ParsedEventQuery } from '../../models/EventQuery'

export interface QueryParser {
  parse(rawText: string, now?: Date): ParsedEventQuery | null
}
