import { describe, expect, it } from 'vitest'
import { LocalQueryParser } from './LocalQueryParser'

const now = new Date(2026, 6, 28, 0, 30)
const parser = new LocalQueryParser()

describe('LocalQueryParser', () => {
  it('parses current-year work event counts', () => {
    expect(parser.parse('今年有幾筆公事？', now)).toMatchObject({
      operation: 'count',
      criteria: { category: '公事', dateFrom: '2026-01-01', dateTo: '2026-12-31' },
      dateLabel: '今年',
    })
  })

  it('parses last-year Japan counts as keyword queries', () => {
    expect(parser.parse('去年去了幾次日本？', now)).toMatchObject({
      operation: 'count',
      criteria: { keyword: '日本', dateFrom: '2025-01-01', dateTo: '2025-12-31' },
    })
  })

  it('parses yearly amount sums and current-month keywords', () => {
    expect(parser.parse('2025 年所得稅總共多少？', now)).toMatchObject({
      operation: 'sum', criteria: { keyword: '所得稅', dateFrom: '2025-01-01', dateTo: '2025-12-31' },
    })
    expect(parser.parse('這個月有哪些 Dell 事件？', now)).toMatchObject({
      operation: 'list', criteria: { keyword: 'Dell', dateFrom: '2026-07-01', dateTo: '2026-07-31' },
    })
  })

  it('combines category, tag, and explicit date ranges', () => {
    expect(parser.parse('2024/01/01 到 2024/12/31 找出標籤是日本的私事', now)).toMatchObject({
      operation: 'related',
      criteria: { category: '私事', tag: '日本', dateFrom: '2024-01-01', dateTo: '2024-12-31' },
    })
  })

  it('parses hashtag searches as exact tag filters', () => {
    expect(parser.parse('#日本', now)).toMatchObject({
      operation: 'related',
      criteria: { tag: '日本' },
    })
    expect(parser.parse('今年 #報稅 的私事', now)).toMatchObject({
      criteria: { category: '私事', tag: '報稅', dateFrom: '2026-01-01', dateTo: '2026-12-31' },
    })
  })

  it('defines comma as OR and plus as AND for multiple keywords', () => {
    expect(parser.parse('所得稅, 日本', now)).toMatchObject({
      criteria: { keyword: '所得稅, 日本', keywordMode: 'any' },
    })
    expect(parser.parse('所得稅 + 日本', now)).toMatchObject({
      criteria: { keyword: '所得稅 + 日本', keywordMode: 'all' },
    })
    expect(parser.parse('所得稅,  日本', now)).toMatchObject({
      criteria: { keyword: '所得稅, 日本', keywordMode: 'any' },
    })
    expect(parser.parse('所得稅  +  日本', now)).toMatchObject({
      criteria: { keyword: '所得稅 + 日本', keywordMode: 'all' },
    })
  })

  it('parses photo and attachment filters', () => {
    expect(parser.parse('有照片的事件', now)).toMatchObject({ criteria: { attachmentKind: 'photo' } })
    expect(parser.parse('有附件的事件', now)).toMatchObject({ criteria: { attachmentKind: 'file' } })
    expect(parser.parse('今年有附件或照片的私事', now)).toMatchObject({
      criteria: { attachmentKind: 'any', category: '私事', dateFrom: '2026-01-01', dateTo: '2026-12-31' },
    })
    expect(parser.parse('搜尋照片與附檔事件', now)).toMatchObject({ criteria: { attachmentKind: 'any' } })
  })

  it('uses local calendar boundaries instead of UTC truncation', () => {
    const localNewYear = new Date(2026, 0, 1, 0, 5)
    expect(parser.parse('今天有哪些事件？', localNewYear)).toMatchObject({
      criteria: { dateFrom: '2026-01-01', dateTo: '2026-01-01' },
    })
    expect(parser.parse('上個月有哪些事件？', localNewYear)).toMatchObject({
      criteria: { dateFrom: '2025-12-01', dateTo: '2025-12-31' },
    })
  })

  it('returns null for unsupported conversational questions', () => {
    expect(parser.parse('你好', now)).toBeNull()
  })
})
