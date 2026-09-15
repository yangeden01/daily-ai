import { Solar, Lunar } from 'lunar-javascript'
import type { Event } from '../models/Event'

export interface UpcomingAnniversary {
  event: Event
  occurrenceDateStr: string // YYYY-MM-DD (Solar/Gregorian)
  daysDiff: number // difference in days from queryStartDate (0 = today, >0 = future)
  formattedSolarDate: string // e.g. "2026/08/20 (四)"
  formattedLunarDate?: string // e.g. "農曆 七月初八" or "農曆 閏四月十五"
  anniversaryCount?: number // e.g. 5 for 5th anniversary / 30 for 30 years old
  anniversaryLabel?: string // e.g. "第 5 週年" or "30 歲生日"
  isToday: boolean
  isTomorrow: boolean
}

/** Check if event is an anniversary */
export const isAnniversaryEvent = (event: Event): boolean => event.recordType === 'anniversary'

/** Solar month names */
export const SOLAR_MONTH_NAMES = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月'
]

/**
 * Returns the maximum days in a solar month.
 * February returns 29 to allow leap day (2/29) anniversaries.
 */
export const getDaysInSolarMonth = (month: number): number => {
  if (month === 2) return 29
  if ([4, 6, 9, 11].includes(month)) return 30
  return 31
}

/**
 * Parse solar month (1-12) and day (1-31) from MM-DD or YYYY-MM-DD
 */
export const parseSolarMonthDay = (dateStr: string): { month: number; day: number } => {
  if (!dateStr) {
    const now = new Date()
    return { month: now.getMonth() + 1, day: now.getDate() }
  }
  const parts = dateStr.split('-').map(Number)
  if (parts.length === 2) {
    return {
      month: Math.min(12, Math.max(1, parts[0] || 1)),
      day: Math.min(31, Math.max(1, parts[1] || 1)),
    }
  }
  if (parts.length >= 3) {
    return {
      month: Math.min(12, Math.max(1, parts[1] || 1)),
      day: Math.min(31, Math.max(1, parts[2] || 1)),
    }
  }
  const now = new Date()
  return { month: now.getMonth() + 1, day: now.getDate() }
}

/**
 * Format solar month and day for display (e.g. "8月16日")
 */
export const formatSolarMonthDay = (dateStr: string): string => {
  const { month, day } = parseSolarMonthDay(dateStr)
  return `${month}月${day}日`
}

/** Lunar month names in Chinese */
export const LUNAR_MONTH_NAMES = [
  '正月 (一月)', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月 (冬月)', '十二月 (臘月)'
]

/** Lunar day names in Chinese (1-30) */
export const LUNAR_DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
]

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

/**
 * Format a Date object to YYYY-MM-DD in local time
 */
export const formatDateToYMD = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export interface LunarDateInfo {
  year: number
  month: number
  day: number
  isLeap: boolean
}

/**
 * Get Lunar date info for a given Gregorian date (defaults to today)
 */
export const getTodayLunarDate = (referenceDate = new Date()): LunarDateInfo => {
  try {
    const solar = Solar.fromDate(referenceDate)
    const lunar = solar.getLunar()
    const rawMonth = lunar.getMonth()
    const month = Math.abs(rawMonth)
    const isLeap = rawMonth < 0
    const day = lunar.getDay()
    const year = lunar.getYear()
    return { year, month, day, isLeap }
  } catch {
    return { year: referenceDate.getFullYear(), month: 1, day: 1, isLeap: false }
  }
}

/**
 * Convert a Solar YYYY-MM-DD or MM-DD string to Lunar date info
 */
export const getLunarFromSolarYMD = (dateStr: string): LunarDateInfo => {
  try {
    const { month, day } = parseSolarMonthDay(dateStr)
    const currentYear = new Date().getFullYear()
    const solar = Solar.fromYmd(currentYear, month, day)
    const lunar = solar.getLunar()
    const rawMonth = lunar.getMonth()
    return {
      year: lunar.getYear(),
      month: Math.abs(rawMonth),
      day: lunar.getDay(),
      isLeap: rawMonth < 0,
    }
  } catch {
    return getTodayLunarDate()
  }
}

/**
 * Parse YYYY-MM-DD string into a local Date object (at 00:00:00)
 */
export const parseYMDToDate = (ymd: string): Date => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0)
}

/**
 * Format date for display with weekday
 * e.g. "2026/08/20 (四)"
 */
export const formatSolarDateWithWeekday = (dateStr: string): string => {
  const date = parseYMDToDate(dateStr)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const w = WEEKDAY_NAMES[date.getDay()]
  return `${y}/${m}/${d} (${w})`
}

/**
 * Convert a Lunar date (year, month, day, isLeap) to Solar YYYY-MM-DD string
 */
export const convertLunarToSolarYMD = (
  lunarYear: number,
  lunarMonth: number,
  lunarDay: number,
  isLeap = false
): string | null => {
  try {
    const monthArg = isLeap ? -Math.abs(lunarMonth) : Math.abs(lunarMonth)
    const lunar = Lunar.fromYmd(lunarYear, monthArg, Math.min(30, Math.max(1, lunarDay)))
    const solar = lunar.getSolar()
    const sy = solar.getYear()
    const sm = String(solar.getMonth()).padStart(2, '0')
    const sd = String(solar.getDay()).padStart(2, '0')
    return `${sy}-${sm}-${sd}`
  } catch {
    return null
  }
}

/**
 * Get Chinese description of a Lunar date
 */
export const formatLunarDateText = (month: number, day: number, isLeap = false, year?: number): string => {
  const monthName = isLeap ? `閏${LUNAR_MONTH_NAMES[month - 1] ?? `${month}月`}` : (LUNAR_MONTH_NAMES[month - 1] ?? `${month}月`)
  const dayName = LUNAR_DAY_NAMES[day - 1] ?? `${day}日`
  if (year) {
    return `農曆 ${year}年 ${monthName}${dayName}`
  }
  return `農曆 ${monthName}${dayName}`
}

/**
 * Calculate upcoming occurrences for a single anniversary event within a date range [startDateStr, endDateStr]
 */
export const getEventOccurrencesInRange = (
  event: Event,
  startDateStr: string,
  endDateStr: string
): UpcomingAnniversary[] => {
  const startDate = parseYMDToDate(startDateStr)
  const endDate = parseYMDToDate(endDateStr)
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()
  const results: UpcomingAnniversary[] = []

  const isLunar = event.calendarType === 'lunar'

  // Years to evaluate (evaluate startYear - 1 to endYear + 1 to handle lunar offset crossing calendar years)
  const yearsToEval = new Set([startYear - 1, startYear, endYear, endYear + 1])

  for (const year of yearsToEval) {
    let occurrenceYMD: string | null = null
    let formattedLunar: string | undefined = undefined

    if (isLunar) {
      const lMonth = event.lunarMonth ?? 1
      const lDay = event.lunarDay ?? 1
      const isLeap = !!event.isLeapMonth
      occurrenceYMD = convertLunarToSolarYMD(year, lMonth, lDay, isLeap)
      formattedLunar = formatLunarDateText(lMonth, lDay, isLeap)
    } else {
      // Solar anniversary - month and day only, no year
      const { month, day } = parseSolarMonthDay(event.date)
      // Handle Feb 29 on non-leap years
      const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
      const targetDay = month === 2 && day === 29 && !isLeapYear ? 28 : day
      const mStr = String(month).padStart(2, '0')
      const dStr = String(targetDay).padStart(2, '0')
      occurrenceYMD = `${year}-${mStr}-${dStr}`
    }

    if (!occurrenceYMD) continue

    const occDate = parseYMDToDate(occurrenceYMD)
    // Check if falls within [startDate, endDate]
    if (occDate >= startDate && occDate <= endDate) {
      const timeDiff = occDate.getTime() - startDate.getTime()
      const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24))

      let anniversaryCount: number | undefined = undefined
      let anniversaryLabel: string | undefined = undefined

      const baseYear = event.targetYear
      if (baseYear && baseYear > 0 && year >= baseYear) {
        anniversaryCount = year - baseYear
        if (anniversaryCount > 0) {
          if (/生日|出世|出生/.test(event.title)) {
            anniversaryLabel = `${anniversaryCount} 歲生日`
          } else if (/週年|周年|結婚|交往|紀念/.test(event.title)) {
            anniversaryLabel = `第 ${anniversaryCount} 週年`
          } else {
            anniversaryLabel = `第 ${anniversaryCount} 年`
          }
        }
      }

      results.push({
        event,
        occurrenceDateStr: occurrenceYMD,
        daysDiff,
        formattedSolarDate: formatSolarDateWithWeekday(occurrenceYMD),
        formattedLunarDate: formattedLunar,
        anniversaryCount,
        anniversaryLabel,
        isToday: daysDiff === 0,
        isTomorrow: daysDiff === 1,
      })
    }
  }

  return results
}

/**
 * Get the solar occurrence date (YYYY-MM-DD) for an anniversary in the current year.
 * - Lunar anniversary: converted to this year's Solar Gregorian date
 * - Solar anniversary: this year's Solar Gregorian date (currentYear-MM-DD)
 */
export const getAnniversaryThisYearSolarDate = (event: Event, currentYear = new Date().getFullYear()): string => {
  if (event.calendarType === 'lunar') {
    const lMonth = event.lunarMonth ?? 1
    const lDay = event.lunarDay ?? 1
    const isLeap = !!event.isLeapMonth
    const solarYMD = convertLunarToSolarYMD(currentYear, lMonth, lDay, isLeap)
    if (solarYMD) return solarYMD
    // Fallback in case leap month does not exist in current year
    const fallback = convertLunarToSolarYMD(currentYear, lMonth, lDay, false)
    if (fallback) return fallback
  }
  const { month, day } = parseSolarMonthDay(event.date)
  const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0
  const targetDay = month === 2 && day === 29 && !isLeapYear ? 28 : day
  const mStr = String(month).padStart(2, '0')
  const dStr = String(targetDay).padStart(2, '0')
  return `${currentYear}-${mStr}-${dStr}`
}

/**
 * Get the next upcoming occurrence (Solar Gregorian date YYYY-MM-DD and days until then)
 * for an anniversary event relative to a reference date (defaults to today).
 * - If the anniversary occurs today, daysUntil is 0.
 * - If the anniversary has already occurred this year (yesterday or earlier), its next occurrence will be next year (daysUntil > 0, up to ~365 days).
 */
export const getAnniversaryNextOccurrence = (
  event: Event,
  referenceDate = new Date()
): { nextSolarYMD: string; daysUntil: number } => {
  const refYMD = formatDateToYMD(referenceDate)
  const refDate = parseYMDToDate(refYMD)
  const currentYear = refDate.getFullYear()

  if (event.calendarType === 'lunar') {
    const lMonth = event.lunarMonth ?? 1
    const lDay = event.lunarDay ?? 1
    const isLeap = !!event.isLeapMonth

    // Evaluate currentYear - 1, currentYear, currentYear + 1, currentYear + 2
    // to find the earliest solar occurrence that is >= refYMD
    const candidateYears = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]
    const occurrences: string[] = []

    for (const yr of candidateYears) {
      let solarYMD = convertLunarToSolarYMD(yr, lMonth, lDay, isLeap)
      if (!solarYMD && isLeap) {
        // Fallback if leap month not present in that year
        solarYMD = convertLunarToSolarYMD(yr, lMonth, lDay, false)
      }
      if (solarYMD) {
        occurrences.push(solarYMD)
      }
    }

    // Filter for dates >= refYMD, and pick the smallest
    const futureOccurrences = occurrences.filter((d) => d >= refYMD).sort()
    if (futureOccurrences.length > 0) {
      const nextSolarYMD = futureOccurrences[0]
      const occDate = parseYMDToDate(nextSolarYMD)
      const diffMs = occDate.getTime() - refDate.getTime()
      const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24))
      return { nextSolarYMD, daysUntil: Math.max(0, daysUntil) }
    }
  }

  // Solar anniversary
  const { month, day } = parseSolarMonthDay(event.date)
  const isLeapCurrent = (currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0
  const targetDayCurrent = month === 2 && day === 29 && !isLeapCurrent ? 28 : day
  const mStr = String(month).padStart(2, '0')
  const thisYearYMD = `${currentYear}-${mStr}-${String(targetDayCurrent).padStart(2, '0')}`

  if (thisYearYMD >= refYMD) {
    const occDate = parseYMDToDate(thisYearYMD)
    const diffMs = occDate.getTime() - refDate.getTime()
    const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24))
    return { nextSolarYMD: thisYearYMD, daysUntil: Math.max(0, daysUntil) }
  }

  // Otherwise next year
  const nextYear = currentYear + 1
  const isLeapNext = (nextYear % 4 === 0 && nextYear % 100 !== 0) || nextYear % 400 === 0
  const targetDayNext = month === 2 && day === 29 && !isLeapNext ? 28 : day
  const nextYearYMD = `${nextYear}-${mStr}-${String(targetDayNext).padStart(2, '0')}`
  const occDate = parseYMDToDate(nextYearYMD)
  const diffMs = occDate.getTime() - refDate.getTime()
  const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24))
  return { nextSolarYMD: nextYearYMD, daysUntil: Math.max(0, daysUntil) }
}

/**
 * Sort anniversary events starting from today and going forward in time
 * (today -> tomorrow -> future dates -> yesterday's date next year).
 */
export const sortAnniversaries = (
  events: Event[],
  referenceDate = new Date()
): Event[] => {
  return [...events].sort((left, right) => {
    const nextLeft = getAnniversaryNextOccurrence(left, referenceDate)
    const nextRight = getAnniversaryNextOccurrence(right, referenceDate)
    const diff = nextLeft.daysUntil - nextRight.daysUntil
    if (diff !== 0) return diff
    return left.title.localeCompare(right.title, 'zh-TW')
  })
}

/**
 * Get the calendar month (1-12) for an event for month-based visual differentiation.
 * - Anniversary: derived from next upcoming Solar occurrence date
 * - Daily: derived from event.date (YYYY-MM-DD)
 * - Notes: derived from last edited / updated date
 */
export const getEventMonth = (event: Event, referenceDate = new Date()): number => {
  if (event.recordType === 'anniversary') {
    const nextOcc = getAnniversaryNextOccurrence(event, referenceDate)
    const [, m] = nextOcc.nextSolarYMD.split('-').map(Number)
    return m || 1
  }
  if (event.date) {
    const parts = event.date.split('-').map(Number)
    if (parts.length >= 2) {
      return parts.length >= 3 ? parts[1] : parts[0]
    }
  }
  if (event.lastEditedAt || event.updatedAt) {
    const d = new Date(event.lastEditedAt ?? event.updatedAt)
    return d.getMonth() + 1
  }
  return 1
}

/**
 * Get all upcoming anniversaries in the next N days starting from startDateStr (default 14 days)
 */
export const getUpcomingAnniversaries = (
  events: Event[],
  startDateStr: string,
  days = 14
): UpcomingAnniversary[] => {
  const startDate = parseYMDToDate(startDateStr)
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + (days - 1)) // 14 days inclusive (day 0 to day 13)
  const endDateStr = formatDateToYMD(endDate)

  const anniversaryEvents = events.filter(isAnniversaryEvent)
  const allOccurrences: UpcomingAnniversary[] = []

  for (const event of anniversaryEvents) {
    const list = getEventOccurrencesInRange(event, startDateStr, endDateStr)
    allOccurrences.push(...list)
  }

  // Sort by occurrence date ascending, then title
  return allOccurrences.sort((a, b) =>
    a.occurrenceDateStr.localeCompare(b.occurrenceDateStr) ||
    a.event.title.localeCompare(b.event.title, 'zh-TW')
  )
}

