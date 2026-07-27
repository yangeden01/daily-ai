import type { LLMProvider } from './LLMProvider'
import type { ParsedEvent } from './ParsedEvent'

export class AIParserService {
  constructor(private readonly provider: LLMProvider) {}

  parseEvent(rawText: string): Promise<ParsedEvent> {
    return this.provider.parseEvent(rawText)
  }
}
