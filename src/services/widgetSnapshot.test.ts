import { describe, expect, it } from 'vitest'
import type { Event } from '../models/Event'
import {
  filterAndSortTodos,
  filterAndSortDailyEvents,
  filterAndSortAnniversaries,
  createWidgetSnapshot,
} from './widgetSnapshot'
import { formatDateToYMD, parseYMDToDate, convertLunarToSolarYMD } from '../utils/anniversary'

describe('Widget Data Filtering & Snapshot Generation', () => {
  const referenceDate = new Date(2026, 8, 14) // 2026-09-14 (month index 8 is September)
  const todayStr = '2026-09-14'

  const makeDateOffset = (offsetDays: number): string => {
    const d = parseYMDToDate(todayStr)
    d.setDate(d.getDate() + offsetDays)
    return formatDateToYMD(d)
  }

  it('1 & 2: includes Note categorized as 待做事項, excludes normal Note and Daily with 待做事項', () => {
    const events: Event[] = [
      {
        id: 'note-todo-1',
        title: '買牛奶',
        detail: '',
        date: '',
        category: '待做事項',
        tags: [],
        attachmentIds: [],
        recordType: 'note',
        createdAt: '2026-09-14T01:00:00.000Z',
        updatedAt: '2026-09-14T02:00:00.000Z',
        lastEditedAt: '2026-09-14T03:00:00.000Z',
      },
      {
        id: 'note-normal-1',
        title: '一般筆記',
        detail: '',
        date: '',
        category: '日常',
        tags: [],
        attachmentIds: [],
        recordType: 'note',
        createdAt: '2026-09-14T01:00:00.000Z',
        updatedAt: '2026-09-14T02:00:00.000Z',
      },
      {
        id: 'daily-todo-category',
        title: 'Daily event with todo category',
        detail: '',
        date: todayStr,
        category: '待做事項',
        tags: [],
        attachmentIds: [],
        recordType: 'daily',
        createdAt: '2026-09-14T01:00:00.000Z',
        updatedAt: '2026-09-14T02:00:00.000Z',
      },
    ]

    const todos = filterAndSortTodos(events)
    expect(todos.length).toBe(1)
    expect(todos[0].id).toBe('note-todo-1')
    expect(todos[0].title).toBe('買牛奶')
    expect(todos[0].route).toBe('/daily/note-todo-1?mode=notes')
  })

  it('sorts todo notes by lastEditedAt descending, falling back to updatedAt descending', () => {
    const events: Event[] = [
      {
        id: 'todo-older',
        title: 'Older note',
        detail: '',
        date: '',
        category: '待做事項',
        tags: [],
        attachmentIds: [],
        recordType: 'note',
        createdAt: '2026-09-10T00:00:00.000Z',
        updatedAt: '2026-09-10T00:00:00.000Z',
        lastEditedAt: '2026-09-10T00:00:00.000Z',
      },
      {
        id: 'todo-newer',
        title: 'Newer note',
        detail: '',
        date: '',
        category: '待做事項',
        tags: [],
        attachmentIds: [],
        recordType: 'note',
        createdAt: '2026-09-11T00:00:00.000Z',
        updatedAt: '2026-09-12T00:00:00.000Z',
        lastEditedAt: '2026-09-13T00:00:00.000Z',
      },
      {
        id: 'todo-fallback-updated',
        title: 'Fallback updated note',
        detail: '',
        date: '',
        category: '待做事項',
        tags: [],
        attachmentIds: [],
        recordType: 'note',
        createdAt: '2026-09-11T00:00:00.000Z',
        updatedAt: '2026-09-14T00:00:00.000Z',
      },
    ]

    const todos = filterAndSortTodos(events)
    expect(todos.map((t) => t.id)).toEqual(['todo-fallback-updated', 'todo-newer', 'todo-older'])
  })

  it('3, 4, 5, 6: Daily events in [today, today + 6] appear; past and today + 7 do not appear', () => {
    const pastDate = makeDateOffset(-1) // 2026-09-13
    const day0 = makeDateOffset(0) // 2026-09-14 (today)
    const day3 = makeDateOffset(3) // 2026-09-17
    const day6 = makeDateOffset(6) // 2026-09-20 (today + 6)
    const day7 = makeDateOffset(7) // 2026-09-21 (today + 7)

    const events: Event[] = [
      {
        id: 'daily-past',
        title: 'Past event',
        detail: '',
        date: pastDate,
        category: '會議',
        tags: [],
        attachmentIds: [],
        createdAt: '2026-09-10T00:00:00.000Z',
        updatedAt: '2026-09-10T00:00:00.000Z',
      },
      {
        id: 'daily-today',
        title: 'Today event',
        detail: '',
        date: day0,
        category: '會議',
        tags: [],
        attachmentIds: [],
        recordType: 'daily',
        createdAt: '2026-09-14T08:00:00.000Z',
        updatedAt: '2026-09-14T08:00:00.000Z',
      },
      {
        id: 'daily-day3',
        title: 'Day 3 event',
        detail: '',
        date: day3,
        category: '約會',
        tags: [],
        attachmentIds: [],
        createdAt: '2026-09-14T09:00:00.000Z',
        updatedAt: '2026-09-14T09:00:00.000Z',
      },
      {
        id: 'daily-day6',
        title: 'Day 6 event',
        detail: '',
        date: day6,
        category: '旅行',
        tags: [],
        attachmentIds: [],
        createdAt: '2026-09-14T10:00:00.000Z',
        updatedAt: '2026-09-14T10:00:00.000Z',
      },
      {
        id: 'daily-day7',
        title: 'Day 7 event',
        detail: '',
        date: day7,
        category: '聚餐',
        tags: [],
        attachmentIds: [],
        createdAt: '2026-09-14T11:00:00.000Z',
        updatedAt: '2026-09-14T11:00:00.000Z',
      },
    ]

    const dailyList = filterAndSortDailyEvents(events, referenceDate)
    const ids = dailyList.map((d) => d.id)

    expect(ids).toContain('daily-today')
    expect(ids).toContain('daily-day3')
    expect(ids).toContain('daily-day6')
    expect(ids).not.toContain('daily-past')
    expect(ids).not.toContain('daily-day7')
    expect(dailyList[0].route).toBe('/daily/daily-today')
  })

  it('sorts daily events by date ascending, then createdAt ascending', () => {
    const day1 = makeDateOffset(1)
    const events: Event[] = [
      {
        id: 'daily-b',
        title: 'Created later on day 1',
        detail: '',
        date: day1,
        category: '',
        tags: [],
        attachmentIds: [],
        createdAt: '2026-09-14T12:00:00.000Z',
        updatedAt: '2026-09-14T12:00:00.000Z',
      },
      {
        id: 'daily-a',
        title: 'Created earlier on day 1',
        detail: '',
        date: day1,
        category: '',
        tags: [],
        attachmentIds: [],
        createdAt: '2026-09-14T08:00:00.000Z',
        updatedAt: '2026-09-14T08:00:00.000Z',
      },
      {
        id: 'daily-today',
        title: 'Today event',
        detail: '',
        date: todayStr,
        category: '',
        tags: [],
        attachmentIds: [],
        createdAt: '2026-09-14T15:00:00.000Z',
        updatedAt: '2026-09-14T15:00:00.000Z',
      },
    ]

    const list = filterAndSortDailyEvents(events, referenceDate)
    expect(list.map((d) => d.id)).toEqual(['daily-today', 'daily-a', 'daily-b'])
  })

  it('7, 8, 9, 10: Anniversaries in [today, today + 2] appear; today + 3 does not appear', () => {
    // Reference date: 2026-09-14
    // today = 09-14 (solar month 9, day 14)
    // today + 2 = 09-16 (solar month 9, day 16)
    // today + 3 = 09-17 (solar month 9, day 17)

    // Let's find what lunar date corresponds to 2026-09-15 (tomorrow, which is within 3 days)
    // In 2026, let's test a lunar anniversary that converts to 2026-09-15
    // Or we can convert Lunar year 2026, month 8, day 5 to check
    const lunarSolarDate = convertLunarToSolarYMD(2026, 8, 5, false) // whatever solar date this is
    // Let's create an anniversary event targeting lunar 8月初5
    const lunarDateStr = lunarSolarDate || '2026-09-15'

    const events: Event[] = [
      {
        id: 'anni-today',
        title: '媽媽生日',
        detail: '',
        date: '09-14',
        category: '紀念日',
        tags: [],
        attachmentIds: [],
        recordType: 'anniversary',
        calendarType: 'solar',
        targetYear: 1966,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'anni-day2',
        title: '結婚紀念日',
        detail: '',
        date: '09-16',
        category: '紀念日',
        tags: [],
        attachmentIds: [],
        recordType: 'anniversary',
        calendarType: 'solar',
        targetYear: 2020,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'anni-day3',
        title: '朋友生日',
        detail: '',
        date: '09-17',
        category: '紀念日',
        tags: [],
        attachmentIds: [],
        recordType: 'anniversary',
        calendarType: 'solar',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]

    const list = filterAndSortAnniversaries(events, referenceDate)
    const eventIds = list.map((a) => a.eventId)

    expect(eventIds).toContain('anni-today')
    expect(eventIds).toContain('anni-day2')
    expect(eventIds).not.toContain('anni-day3')

    const todayItem = list.find((a) => a.eventId === 'anni-today')
    expect(todayItem?.solarDate).toBe('2026-09-14')
    expect(todayItem?.anniversaryLabel).toBe('60 歲生日')
    expect(todayItem?.route).toBe('/daily/anni-today?mode=anniversary')

    const day2Item = list.find((a) => a.eventId === 'anni-day2')
    expect(day2Item?.solarDate).toBe('2026-09-16')
    expect(day2Item?.anniversaryLabel).toBe('第 6 週年')
  })

  it('supports lunar anniversary conversion within 3 days', () => {
    // Find what lunar date maps to 2026-09-15
    // 2026-09-15 is Lunar 2026-08-05
    const lunarYMD = convertLunarToSolarYMD(2026, 8, 5, false)
    expect(lunarYMD).toBeDefined()

    // If we set referenceDate to 1 day before lunarYMD:
    const refDate = parseYMDToDate(lunarYMD!)
    refDate.setDate(refDate.getDate() - 1) // 1 day before, so lunar anniversary occurs tomorrow (within 3 days)

    const event: Event = {
      id: 'lunar-anni',
      title: '奶奶農曆生日',
      detail: '',
      date: '08-05',
      category: '紀念日',
      tags: [],
      attachmentIds: [],
      recordType: 'anniversary',
      calendarType: 'lunar',
      lunarMonth: 8,
      lunarDay: 5,
      isLeapMonth: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const list = filterAndSortAnniversaries([event], refDate)
    expect(list.length).toBe(1)
    expect(list[0].eventId).toBe('lunar-anni')
    expect(list[0].solarDate).toBe(lunarYMD)
  })

  it('creates full widget snapshot with metadata', () => {
    const snapshot = createWidgetSnapshot([], referenceDate)
    expect(snapshot.version).toBe(1)
    expect(snapshot.generatedDateStr).toBe('2026-09-14')
    expect(snapshot.todos).toEqual([])
    expect(snapshot.dailyEvents).toEqual([])
    expect(snapshot.anniversaries).toEqual([])
  })
})
