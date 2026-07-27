import type { ParsedEvent } from './ParsedEvent'

export interface LLMProvider {
  parseEvent(rawText: string): Promise<ParsedEvent>
}
