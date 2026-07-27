import type { LLMProvider } from './LLMProvider'
import type { ParsedEvent } from './ParsedEvent'

type ParsingRule = {
  matches: (rawText: string) => boolean
  parse: (rawText: string) => ParsedEvent
}

const extractAmount = (rawText: string): number | undefined => {
  const match = rawText.match(/(\d[\d,]*)\s*元/)
  if (!match) return undefined
  return Number(match[1].replace(/,/g, ''))
}

const rules: ParsingRule[] = [
  {
    matches: (rawText) => /國稅局|綜所稅|所得稅|報稅/.test(rawText),
    parse: (rawText) => ({
      title: '綜合所得稅',
      category: 'finance',
      amount: extractAmount(rawText),
      tags: ['所得稅', '報稅', '國稅局'],
      rawText,
      confidence: 0.98,
    }),
  },
  {
    matches: (rawText) => /旅行|旅遊|日本|九州/.test(rawText),
    parse: (rawText) => ({
      title: '旅行紀錄',
      category: 'travel',
      tags: ['旅行'],
      rawText,
      confidence: 0.9,
    }),
  },
  {
    matches: (rawText) => /Dell|VP|Volta|EVT|會議/.test(rawText),
    parse: (rawText) => ({
      title: '工作紀錄',
      category: 'work',
      tags: ['工作'],
      rawText,
      confidence: 0.9,
    }),
  },
]

export class MockProvider implements LLMProvider {
  async parseEvent(rawText: string): Promise<ParsedEvent> {
    const normalizedText = rawText.trim()
    const rule = rules.find((candidate) => candidate.matches(normalizedText))

    if (rule) return rule.parse(normalizedText)

    return {
      title: normalizedText.slice(0, 24) || '未命名事件',
      category: 'general',
      tags: [],
      rawText: normalizedText,
      confidence: 0.5,
    }
  }
}
