import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, Inbox, LayoutGrid } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Event } from '../../models/Event'
import { eventRepository } from '../../repositories'
import { calculateEventStatistics } from '../../utils/calculateEventStatistics'
import { restoreListPosition, saveListPosition } from '../../utils/listPosition'
import { appModeFromSearch, routeForMode } from '../../utils/appMode'
import { isDailyEvent, isNoteEvent, sortNotes } from '../../utils/noteEvents'

const currentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const formatMonth = (month: string) => {
  const [year, monthNumber] = month.split('-')
  return `${year}/${monthNumber}`
}

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = appModeFromSearch(`?${searchParams.toString()}`)
  const isNotesMode = mode === 'notes'
  const monthFromUrl = searchParams.get('month')
  const initialMonth = monthFromUrl && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthFromUrl) ? monthFromUrl : currentMonth()
  const [events, setEvents] = useState<Event[]>([])
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    eventRepository.getAll()
      .then(setEvents)
      .catch(() => setError('暫時無法讀取統計資料，請稍後再試。'))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (monthFromUrl && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthFromUrl)) setSelectedMonth(monthFromUrl)
  }, [monthFromUrl])

  const selectMonth = (month: string) => {
    const nextMonth = month || currentMonth()
    setSelectedMonth(nextMonth)
    const next = new URLSearchParams(searchParams)
    next.set('month', nextMonth)
    setSearchParams(next)
  }

  const dailyEvents = useMemo(() => events.filter(isDailyEvent), [events])
  const noteEvents = useMemo(() => sortNotes(events.filter(isNoteEvent), 'recent'), [events])
  const statistics = useMemo(
    () => calculateEventStatistics(dailyEvents, selectedMonth),
    [dailyEvents, selectedMonth],
  )
  const noteCategories = useMemo(() => Object.entries(noteEvents.reduce<Record<string, number>>((counts, event) => {
    counts[event.category] = (counts[event.category] ?? 0) + 1
    return counts
  }, {})).map(([category, count]) => ({ category, count })).sort((left, right) => right.count - left.count), [noteEvents])
  const visibleCategories = isNotesMode ? noteCategories : statistics.categories
  const visibleCount = isNotesMode ? noteEvents.length : statistics.eventCount
  const maxCategoryCount = Math.max(1, ...visibleCategories.map(({ count }) => count))
  const selectedEvents = useMemo(
    () => isNotesMode ? noteEvents : dailyEvents
      .filter((event) => event.date.slice(0, 7) === selectedMonth)
      .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt)),
    [dailyEvents, isNotesMode, noteEvents, selectedMonth],
  )

  const dashboardRouteKey = isNotesMode ? routeForMode('/dashboard', mode) : `/dashboard?month=${selectedMonth}`

  useEffect(() => {
    if (!isLoading) restoreListPosition(dashboardRouteKey)
  }, [dashboardRouteKey, isLoading])

  return (
    <main className="page-enter space-y-5">
      <section className="dashboard-heading">
        <div>
          <p className="section-label !mb-1 !px-0">{isNotesMode ? '記事摘要' : '統計月份'}</p>
          <h2 className="text-2xl font-bold tracking-tight text-stone-950 dark:text-white">
            {isNotesMode ? 'Notes 摘要' : `${formatMonth(selectedMonth)} 摘要`}
          </h2>
        </div>
        {!isNotesMode && <label className="month-picker">
          <span className="sr-only">選擇統計月份</span>
          <CalendarDays size={17} aria-hidden="true" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => selectMonth(event.target.value)}
          />
        </label>}
      </section>

      {error ? <div className="error-notice" role="alert">{error}</div> : null}

      {isLoading ? (
        <div className="dashboard-empty">正在整理事件統計…</div>
      ) : (
        <>
          <section className="dashboard-card" aria-labelledby="category-distribution-title">
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-stone-100 pb-5 dark:border-white/10">
              <div>
                <p className="text-xs font-semibold text-stone-400">{isNotesMode ? '記事總數' : '本月事件'}</p>
                <strong className="mt-1 block text-2xl font-bold tracking-tight text-stone-950 dark:text-white">
                  {visibleCount}<small className="ml-1 text-xs font-semibold text-stone-400">筆</small>
                </strong>
              </div>
              <span className="dashboard-summary-icon !mb-0"><LayoutGrid size={19} /></span>
            </div>
            <h3 id="category-distribution-title">類別分布</h3>
            {visibleCount === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-stone-400">
                <Inbox size={28} aria-hidden="true" />
                <strong className="text-stone-700 dark:text-stone-200">{isNotesMode ? '目前還沒有記事' : '這個月份還沒有事件'}</strong>
                <span>{isNotesMode ? '新增記事後，統計會自動出現在這裡。' : '新增事件後，統計會自動出現在這裡。'}</span>
              </div>
            ) : (
              <div className="stat-list">
                {visibleCategories.map(({ category, count }) => (
                  <div className="stat-row" key={category}>
                    <div className="stat-row-label"><span>{category}</span><strong>{count}</strong></div>
                    <div className="stat-track"><span style={{ width: `${(count / maxCategoryCount) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="!mb-0">{isNotesMode ? '最近修改記事' : '本月事件列表'}</h3>
              <span className="text-xs tabular-nums text-stone-400">{selectedEvents.length} 筆</span>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="dashboard-card-empty">{isNotesMode ? '目前還沒有記事。' : '這個月份還沒有事件。'}</p>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-white/10">
                {selectedEvents.map((event) => (
                  <Link
                    className="flex items-center gap-3 py-3 transition hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:text-indigo-300"
                    to={routeForMode(`/daily/${event.id}`, mode)}
                    state={{ returnTo: dashboardRouteKey, returnLabel: 'Dashboard' }}
                    data-event-id={event.id}
                    onClick={() => saveListPosition(dashboardRouteKey, event.id)}
                    key={event.id}
                  >
                    <div className="min-w-0 flex-1">
                      <time className="text-xs text-stone-400" dateTime={isNotesMode ? event.lastEditedAt ?? event.updatedAt : event.date}>{isNotesMode ? `修改於 ${new Date(event.lastEditedAt ?? event.updatedAt).toLocaleDateString('zh-TW')}` : event.date}</time>
                      <p className="mt-1 truncate text-sm font-semibold text-stone-900 dark:text-stone-100">{event.title}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">{event.category}</span>
                    <ChevronRight size={16} className="shrink-0 text-stone-300 dark:text-stone-600" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
