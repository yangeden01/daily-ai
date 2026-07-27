export interface ParsedEvent {
  title: string
  category: string
  amount?: number
  tags: string[]
  rawText: string
  confidence: number
}
