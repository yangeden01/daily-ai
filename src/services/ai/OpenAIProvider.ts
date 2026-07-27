import type { LLMProvider } from './LLMProvider'
import type { ParsedEvent } from './ParsedEvent'

export class OpenAIProvider implements LLMProvider {
  async parseEvent(_rawText: string): Promise<ParsedEvent> {
    throw new Error('OpenAIProvider is not implemented')
  }
}
