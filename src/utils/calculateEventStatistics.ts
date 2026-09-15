import type { Event } from '../models/Event'
import type { EventStatistics, MonthlyStatistic } from '../models/EventStatistics'

const monthKey = (year: number, monthIndex: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}`

const getRecentMonths = (selectedMonth: string): MonthlyStatistic[] => {
  const [year, month] = selectedMonth.split('-').map(Number)

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, month - 1 - (5 - index), 1)
    return { month: monthKey(date.getFullYear(), date.getMonth()), count: 0 }
  })
}

export const calculateEventStatistics = (
  events: Event[],
  selectedMonth: string,
): EventStatistics => {
  const selectedEvents = events.filter((event) => event.date.slice(0, 7) === selectedMonth)
  const categoryCounts = new Map<string, number>()

  selectedEvents.forEach((event) => {
    const category = event.category.trim() || 'Uncategorized'
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
  })

  const recentMonths = getRecentMonths(selectedMonth)
  const recentMonthCounts = new Map(recentMonths.map(({ month }) => [month, 0]))

  events.forEach((event) => {
    const eventMonth = event.date.slice(0, 7)
    if (recentMonthCounts.has(eventMonth)) {
      recentMonthCounts.set(eventMonth, (recentMonthCounts.get(eventMonth) ?? 0) + 1)
    }
  })

  return {
    eventCount: selectedEvents.length,
    amountTotal: selectedEvents.reduce((total, event) => total + (event.amount ?? 0), 0),
    categories: [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
    recentMonths: recentMonths.map(({ month }) => ({
      month,
      count: recentMonthCounts.get(month) ?? 0,
    })),
  }
}
