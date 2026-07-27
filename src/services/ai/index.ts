export { AIParserService } from './AIParserService'
export type { LLMProvider } from './LLMProvider'
export { MockProvider } from './MockProvider'
export { OpenAIProvider } from './OpenAIProvider'
export type { ParsedEvent } from './ParsedEvent'

import { AIParserService } from './AIParserService'
import { MockProvider } from './MockProvider'

// Application composition root. Swap the provider here without changing consumers.
export const aiParserService = new AIParserService(new MockProvider())
