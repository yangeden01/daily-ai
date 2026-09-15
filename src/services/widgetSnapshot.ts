import type { Event } from '../models/Event'
import { toLocalDateInputValue } from '../utils/localDate'
import { parseYMDToDate, formatDateToYMD, getEventOccurrencesInRange } from '../utils/anniversary'
import { isTodoNote, isDailyEvent, isAnniversaryEvent } from '../utils/noteEvents'

export interface WidgetTodoItem {
  id: string
  recordType: 'note'
  title: string
  category: string
  lastEditedAt: string
  updatedAt: string
  route: string
}

export interface WidgetDailyItem {
  id: string
  recordType: 'daily'
  title: string
  category: string
  date: string // YYYY-MM-DD
  createdAt: string
  updatedAt: string
  route: string
}

export interface WidgetAnniversaryItem {
  id: string
  eventId: string
  recordType: 'anniversary'
  title: string
  category: string
  calendarType: 'solar' | 'lunar'
  originalDate: string
  solarDate: string // YYYY-MM-DD
  anniversaryLabel?: string
  formattedSolarDate: string
  formattedLunarDate?: string
  route: string
}

export interface WidgetSnapshot {
  version: number
  generatedAt: string
  generatedDateStr: string
  todos: WidgetTodoItem[]
  dailyEvents: WidgetDailyItem[]
  anniversaries: WidgetAnniversaryItem[]
}

/**
 * Filter and sort todo notes:
 * - recordType === 'note'
 * - category.trim() === '待做事項'
 * - Sorted by lastEditedAt descending, falling back to updatedAt descending
 */
export const filterAndSortTodos = (events: Event[]): WidgetTodoItem[] => {
  return events
    .filter(isTodoNote)
    .sort((a, b) => {
      const timeA = a.lastEditedAt || a.updatedAt || ''
      const timeB = b.lastEditedAt || b.updatedAt || ''
      return timeB.localeCompare(timeA)
    })
    .map((event) => ({
      id: event.id,
      recordType: 'note' as const,
      title: event.title,
      category: event.category,
      lastEditedAt: event.lastEditedAt || event.updatedAt,
      updatedAt: event.updatedAt,
      route: `/daily/${event.id}?mode=notes`,
    }))
}

/**
 * Filter and sort daily events for the next 7 calendar days [today, today + 6 days] inclusive:
 * - recordType is missing or recordType === 'daily'
 * - date is between today and today + 6 days inclusive
 * - Sorted by date ascending, then createdAt ascending
 */
export const filterAndSortDailyEvents = (
  events: Event[],
  referenceDate = new Date()
): WidgetDailyItem[] => {
  const todayStr = toLocalDateInputValue(referenceDate)
  const refDateObj = parseYMDToDate(todayStr)
  const endDateObj = new Date(refDateObj)
  endDateObj.setDate(refDateObj.getDate() + 6)
  const endStr = formatDateToYMD(endDateObj)

  return events
    .filter((event) => {
      if (!isDailyEvent(event) || !event.date) return false
      return event.date >= todayStr && event.date <= endStr
    })
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return (a.createdAt || '').localeCompare(b.createdAt || '')
    })
    .map((event) => ({
      id: event.id,
      recordType: 'daily' as const,
      title: event.title,
      category: event.category,
      date: event.date,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      route: `/daily/${event.id}`,
    }))
}

/**
 * Filter and sort anniversaries occurring in the next 3 calendar days [today, today + 2 days] inclusive:
 * - recordType === 'anniversary'
 * - occurrence within today and today + 2 days inclusive (solar & lunar)
 * - Sorted by solar date ascending, then title
 */
export const filterAndSortAnniversaries = (
  events: Event[],
  referenceDate = new Date()
): WidgetAnniversaryItem[] => {
  const todayStr = toLocalDateInputValue(referenceDate)
  const refDateObj = parseYMDToDate(todayStr)
  const endDateObj = new Date(refDateObj)
  endDateObj.setDate(refDateObj.getDate() + 2)
  const endStr = formatDateToYMD(endDateObj)

  const anniversaryEvents = events.filter(isAnniversaryEvent)
  const items: WidgetAnniversaryItem[] = []

  for (const event of anniversaryEvents) {
    const occurrences = getEventOccurrencesInRange(event, todayStr, endStr)
    for (const occ of occurrences) {
      items.push({
        id: `${event.id}_${occ.occurrenceDateStr}`,
        eventId: event.id,
        recordType: 'anniversary' as const,
        title: event.title,
        category: event.category,
        calendarType: event.calendarType ?? 'solar',
        originalDate: event.date,
        solarDate: occ.occurrenceDateStr,
        anniversaryLabel: occ.anniversaryLabel,
        formattedSolarDate: occ.formattedSolarDate,
        formattedLunarDate: occ.formattedLunarDate,
        route: `/daily/${event.id}?mode=anniversary`,
      })
    }
  }

  return items.sort((a, b) => {
    const dateCompare = a.solarDate.localeCompare(b.solarDate)
    if (dateCompare !== 0) return dateCompare
    return a.title.localeCompare(b.title, 'zh-TW')
  })
}

/**
 * Generate a widget-safe snapshot from full events list.
 * Includes all active todos, extended daily events (next 30 days for offline rollover),
 * and upcoming anniversary occurrences (next 60 days).
 */
export const createWidgetSnapshot = (
  events: Event[],
  referenceDate = new Date()
): WidgetSnapshot => {
  const todayStr = toLocalDateInputValue(referenceDate)
  const refDateObj = parseYMDToDate(todayStr)

  // Extended Daily window for local native caching (today to today + 30 days)
  const dailyEndObj = new Date(refDateObj)
  dailyEndObj.setDate(refDateObj.getDate() + 30)
  const dailyEndStr = formatDateToYMD(dailyEndObj)

  // Extended Anniversary window (today to today + 60 days)
  const anniEndObj = new Date(refDateObj)
  anniEndObj.setDate(refDateObj.getDate() + 60)
  const anniEndStr = formatDateToYMD(anniEndObj)

  const todos = filterAndSortTodos(events)

  const dailyEvents = events
    .filter((event) => {
      if (!isDailyEvent(event) || !event.date) return false
      return event.date >= todayStr && event.date <= dailyEndStr
    })
    .sort((a, b) => {
      const cmp = a.date.localeCompare(b.date)
      if (cmp !== 0) return cmp
      return (a.createdAt || '').localeCompare(b.createdAt || '')
    })
    .map((event) => ({
      id: event.id,
      recordType: 'daily' as const,
      title: event.title,
      category: event.category,
      date: event.date,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      route: `/daily/${event.id}`,
    }))

  const anniversaryEvents = events.filter(isAnniversaryEvent)
  const anniversaries: WidgetAnniversaryItem[] = []

  for (const event of anniversaryEvents) {
    const occurrences = getEventOccurrencesInRange(event, todayStr, anniEndStr)
    for (const occ of occurrences) {
      anniversaries.push({
        id: `${event.id}_${occ.occurrenceDateStr}`,
        eventId: event.id,
        recordType: 'anniversary' as const,
        title: event.title,
        category: event.category,
        calendarType: event.calendarType ?? 'solar',
        originalDate: event.date,
        solarDate: occ.occurrenceDateStr,
        anniversaryLabel: occ.anniversaryLabel,
        formattedSolarDate: occ.formattedSolarDate,
        formattedLunarDate: occ.formattedLunarDate,
        route: `/daily/${event.id}?mode=anniversary`,
      })
    }
  }

  anniversaries.sort((a, b) => {
    const cmp = a.solarDate.localeCompare(b.solarDate)
    if (cmp !== 0) return cmp
    return a.title.localeCompare(b.title, 'zh-TW')
  })

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    generatedDateStr: todayStr,
    todos,
    dailyEvents,
    anniversaries,
  }
}
