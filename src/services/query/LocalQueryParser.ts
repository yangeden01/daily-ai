import type { EventSearchCriteria } from '../../models/EventSearchCriteria'
import type { EventQueryOperation, ParsedEventQuery } from '../../models/EventQuery'
import type { QueryParser } from './QueryParser'
import { formatLocalDate, monthRange, yearRange } from './localDate'

const categories = ['機密公事', '私事', '公事'] as const

const normalizeDate = (year: string, month: string, day: string): string | null => {
  const value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))
  return formatLocalDate(parsed) === value ? value : null
}

const operationFor = (text: string): EventQueryOperation | null => {
  if (/(總共多少|金額合計|合計金額|總金額|總額|多少錢|花了多少|繳了多少)/i.test(text)) return 'sum'
  if (/(有幾筆|有幾次|幾筆|幾次|事件數|紀錄數|記錄數|多少筆|多少次)/i.test(text)) return 'count'
  if (/(找出|搜尋|查詢|相關)/i.test(text)) return 'related'
  if (/(哪些|列出|事件|紀錄|記錄)/i.test(text)) return 'list'
  return null
}

const parseTag = (text: string): string | undefined => {
  const hashtag = text.match(/#([^\s#，。？！]+)/)
  if (hashtag?.[1]) return hashtag[1].trim()
  const match = text.match(/(?:標籤|tag)\s*(?:是|為|:|：)?\s*([^\s，。？！]+?)(?=的(?:機密公事|私事|公事)|[，。？！\s]|$)/i)
  return match?.[1]?.trim()
}

const parseAttachmentKind = (text: string): EventSearchCriteria['attachmentKind'] => {
  if (/(附件或照片|照片或附件|照片[與和]附檔|附檔[與和]照片)/.test(text)) return 'any'
  if (/照片/.test(text)) return 'photo'
  if (/(附件|附檔)/.test(text)) return 'file'
  return undefined
}

const parseTime = (text: string, now: Date): { criteria: Pick<EventSearchCriteria, 'dateFrom' | 'dateTo'>; label?: string; consumed: RegExp[] } => {
  const range = text.match(/(\d{4})[年/.-]\s*(\d{1,2})[月/.-]\s*(\d{1,2})日?\s*(?:到|至|~|～)\s*(\d{4})[年/.-]\s*(\d{1,2})[月/.-]\s*(\d{1,2})日?/)
  if (range) {
    const dateFrom = normalizeDate(range[1], range[2], range[3])
    const dateTo = normalizeDate(range[4], range[5], range[6])
    if (dateFrom && dateTo && dateFrom <= dateTo) {
      return { criteria: { dateFrom, dateTo }, label: `${dateFrom} 至 ${dateTo}`, consumed: [new RegExp(range[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))] }
    }
  }

  const yearMonth = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/)
  if (yearMonth) {
    const year = Number(yearMonth[1])
    const month = Number(yearMonth[2])
    if (month >= 1 && month <= 12) return { criteria: monthRange(year, month - 1), label: `${year} 年 ${month} 月`, consumed: [/\d{4}\s*年\s*\d{1,2}\s*月/] }
  }

  const year = text.match(/(\d{4})\s*年/)
  if (year) return { criteria: yearRange(Number(year[1])), label: `${year[1]} 年`, consumed: [/\d{4}\s*年/] }

  const currentYear = now.getFullYear()
  if (/今天/.test(text)) {
    const today = formatLocalDate(now)
    return { criteria: { dateFrom: today, dateTo: today }, label: '今天', consumed: [/今天/] }
  }
  if (/(本月|這個月)/.test(text)) return { criteria: monthRange(currentYear, now.getMonth()), label: '本月', consumed: [/(本月|這個月)/] }
  if (/上個月/.test(text)) {
    const previous = new Date(currentYear, now.getMonth() - 1, 1)
    return { criteria: monthRange(previous.getFullYear(), previous.getMonth()), label: '上個月', consumed: [/上個月/] }
  }
  if (/今年/.test(text)) return { criteria: yearRange(currentYear), label: '今年', consumed: [/今年/] }
  if (/去年/.test(text)) return { criteria: yearRange(currentYear - 1), label: '去年', consumed: [/去年/] }
  return { criteria: {}, consumed: [] }
}

const keywordFor = (text: string, consumed: RegExp[], category?: string, tag?: string): Pick<EventSearchCriteria, 'keyword' | 'keywordMode'> => {
  let remainder = text
  consumed.forEach((pattern) => { remainder = remainder.replace(pattern, ' ') })
  if (category) remainder = remainder.replace(new RegExp(category, 'g'), ' ')
  remainder = remainder.replace(/(?:標籤|tag)\s*(?:是|為|:|：)?\s*[^\s，。？！]+/gi, ' ')
  remainder = remainder.replace(/#[^\s#，。？！]+/g, ' ')
  remainder = remainder.replace(/(?:有|含|包含|搜尋)?(?:附件或照片|照片或附件|照片[與和]附檔|附檔[與和]照片|附件|附檔|照片)(?:的)?/g, ' ')
  if (tag) remainder = remainder.replace(new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ')
  remainder = remainder
    .replace(/(總共多少|金額合計|合計金額|總金額|總額|多少錢|花了多少|繳了多少|有幾筆|有幾次|幾筆|幾次|事件數|紀錄數|記錄數|多少筆|多少次|找出|搜尋|查詢|相關|哪些|列出|事件|紀錄|記錄|去了|有|的|請問)/gi, ' ')
    .replace(/[？?！!。:：]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!remainder) return {}

  const hasAllSeparator = remainder.includes('+')
  const hasAnySeparator = /[，,]/.test(remainder)
  const separator = hasAllSeparator ? /\s*\+\s*/ : hasAnySeparator ? /\s*[，,]\s*/ : null
  const terms = separator
    ? remainder.split(separator).map((term) => term.trim()).filter(Boolean)
    : [remainder]

  return {
    keyword: terms.join(hasAllSeparator ? ' + ' : hasAnySeparator ? ', ' : ' '),
    ...(terms.length > 1 ? { keywordMode: hasAllSeparator ? 'all' : 'any' } : {}),
  }
}

export class LocalQueryParser implements QueryParser {
  parse(rawText: string, now = new Date()): ParsedEventQuery | null {
    const text = rawText.trim()
    if (!text) return null

    const time = parseTime(text, now)
    const category = categories.find((item) => text.includes(item))
    const tag = parseTag(text)
    const attachmentKind = parseAttachmentKind(text)
    const operation = operationFor(text)
    const keywordCriteria = keywordFor(text, time.consumed, category, tag)
    const keyword = keywordCriteria.keyword
    if (!operation && !category && !tag && !attachmentKind && !time.label && /^(你好|哈囉|嗨|謝謝|你是誰|今天天氣)$/.test(keyword ?? '')) return null
    if (!operation && !category && !tag && !attachmentKind && !keyword && !time.label) return null
    if (!operation && keyword && !category && !tag && !time.label && keyword.length < 2) return null

    return {
      rawText: text,
      operation: operation ?? 'related',
      criteria: { ...time.criteria, ...(category ? { category } : {}), ...(tag ? { tag } : {}), ...keywordCriteria, ...(attachmentKind ? { attachmentKind } : {}) },
      ...(time.label ? { dateLabel: time.label } : {}),
    }
  }
}
