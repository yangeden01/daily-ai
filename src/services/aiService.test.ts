import { describe, expect, it } from 'vitest'
import {
  cleanTextForSpeech,
  chunkSpeechText,
  localSmartAnalyze,
  parseEdenNoteAction,
} from './aiService'
import type { Event } from '../models/Event'

describe('aiService - Note Actions & Speech Helpers', () => {
  it('parses valid edennote-action block and returns clean content', () => {
    const rawContent = '好的！已為您記錄。\n```edennote-action\n{\n  "action": "create",\n  "data": {\n    "date": "2026-10-22",\n    "title": "看牙醫",\n    "category": "醫療",\n    "amount": 200\n  }\n}\n```\n祝您看診順利！'

    const { action, cleanContent } = parseEdenNoteAction(rawContent)
    expect(action).not.toBeNull()
    expect(action?.action).toBe('create')
    expect(action?.data.title).toBe('看牙醫')
    expect(action?.data.amount).toBe(200)
    expect(cleanContent).toContain('好的！已為您記錄。')
    expect(cleanContent).toContain('祝您看診順利！')
    expect(cleanContent).not.toContain('```edennote-action')
  })

  it('handles content without action gracefully', () => {
    const rawContent = '這是純文字回覆，沒有任何動作。'
    const { action, cleanContent } = parseEdenNoteAction(rawContent)
    expect(action).toBeNull()
    expect(cleanContent).toBe(rawContent)
  })

  it('cleans markdown into smooth natural spoken text for TTS', () => {
    const rawMarkdown = '### 📊 歷年薪資分析\n\n- **最新薪資**：65,000 TWD\n- [事件詳情](event:123)\n| 日期 | 金額 |\n| 2026 | 65000 |\n\n年化複合成長率 CAGR 約 12%。'
    const spoken = cleanTextForSpeech(rawMarkdown)

    expect(spoken).not.toContain('###')
    expect(spoken).not.toContain('**')
    expect(spoken).not.toContain('CAGR')
    expect(spoken).toContain('年化複合成長率')
    expect(spoken).not.toContain('|')
    expect(spoken).toContain('65,000 元')
  })

  it('splits spoken text into compact phrases avoiding Android TTS stalls', () => {
    const sampleText = '明天晚上您有安排一場聚餐。明晚聚餐資訊，活動，跟好友一起吃飯。詳細內容已記錄在畫面中。'
    const chunks = chunkSpeechText(sampleText, 30)

    expect(chunks.length).toBeGreaterThanOrEqual(2)
    chunks.forEach((chunk: string) => {
      expect(chunk.length).toBeLessThanOrEqual(35)
      expect(chunk.trim().length).toBeGreaterThan(0)
    })
  })

  it('triggers local note creation action when user asks to add note', () => {
    const sampleEvents: Event[] = []
    const prompt = '幫我記一下明天下午看牙醫 掛號費 150 元'
    const reply = localSmartAnalyze(prompt, sampleEvents)

    const { action, cleanContent } = parseEdenNoteAction(reply)
    expect(action).not.toBeNull()
    expect(action?.action).toBe('create')
    expect(action?.data.amount).toBe(150)
    expect(action?.data.category).toBe('醫療')
    expect(cleanContent).toContain('看牙醫')
  })

  it('triggers local note deletion action when user asks to delete note', () => {
    const sampleEvents: Event[] = [
      {
        id: 'evt-101',
        date: '2026-10-20',
        title: '看牙醫',
        detail: '洗牙',
        category: '醫療',
        tags: [],
        attachmentIds: [],
        createdAt: '2026-10-20T00:00:00Z',
        updatedAt: '2026-10-20T00:00:00Z',
      },
    ]
    const prompt = '幫我刪除看牙醫的記事'
    const reply = localSmartAnalyze(prompt, sampleEvents)

    const { action, cleanContent } = parseEdenNoteAction(reply)
    expect(action).not.toBeNull()
    expect(action?.action).toBe('delete')
    expect(action?.data.id).toBe('evt-101')
    expect(cleanContent).toContain('已自 EdenNote 移除')
  })
})
