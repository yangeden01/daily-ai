import { useEffect, useMemo, useState } from 'react'
import { Calendar, CalendarDays, ChevronRight, Gift, Heart, Inbox, LayoutGrid, Moon, Sparkles, Sun } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Event } from '../../models/Event'
import { eventRepository } from '../../repositories'
import { calculateEventStatistics } from '../../utils/calculateEventStatistics'
import { restoreListPosition, saveListPosition } from '../../utils/listPosition'
import { appModeFromSearch, routeForMode } from '../../utils/appMode'
import { isAnniversaryEvent, isDailyEvent, isFutureDailyEvent, isNoteEvent, isTodoNote, sortNotes } from '../../utils/noteEvents'
import { formatDateToYMD, formatSolarDateWithWeekday, getUpcomingAnniversaries, parseYMDToDate } from '../../utils/anniversary'
import { LinkifiedText } from '../../components/LinkifiedText'

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
  const isAnniversaryMode = mode === 'anniversary'

  const todayStr = useMemo(() => formatDateToYMD(new Date()), [])
  const monthFromUrl = searchParams.get('month')
  const startDateFromUrl = searchParams.get('startDate')

  const initialMonth = monthFromUrl && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthFromUrl) ? monthFromUrl : currentMonth()
  const initialStartDate = startDateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(startDateFromUrl) ? startDateFromUrl : todayStr

  const [events, setEvents] = useState<Event[]>([])
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [selectedStartDate, setSelectedStartDate] = useState(initialStartDate)
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
    if (startDateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(startDateFromUrl)) setSelectedStartDate(startDateFromUrl)
  }, [monthFromUrl, startDateFromUrl])

  const selectMonth = (month: string) => {
    const nextMonth = month || currentMonth()
    setSelectedMonth(nextMonth)
    const next = new URLSearchParams(searchParams)
    next.set('month', nextMonth)
    setSearchParams(next)
  }

  const selectStartDate = (date: string) => {
    const nextDate = date || todayStr
    setSelectedStartDate(nextDate)
    const next = new URLSearchParams(searchParams)
    next.set('startDate', nextDate)
    setSearchParams(next)
  }

  const resetToToday = () => {
    selectStartDate(todayStr)
  }

  const dailyEvents = useMemo(() => events.filter(isDailyEvent), [events])
  const noteEvents = useMemo(() => sortNotes(events.filter(isNoteEvent), 'recent'), [events])
  const anniversaryEvents = useMemo(() => events.filter(isAnniversaryEvent), [events])

  // Daily Mode Stats
  const statistics = useMemo(
    () => calculateEventStatistics(dailyEvents, selectedMonth),
    [dailyEvents, selectedMonth],
  )

  // Notes Mode Categories
  const noteCategories = useMemo(() => Object.entries(noteEvents.reduce<Record<string, number>>((counts, event) => {
    counts[event.category] = (counts[event.category] ?? 0) + 1
    return counts
  }, {})).map(([category, count]) => ({ category, count })).sort((left, right) => right.count - left.count), [noteEvents])

  // Anniversary Mode Upcoming List (14 days from selectedStartDate)
  const upcomingAnniversaries = useMemo(
    () => getUpcomingAnniversaries(anniversaryEvents, selectedStartDate, 14),
    [anniversaryEvents, selectedStartDate],
  )

  // End Date string for display
  const endDateStr = useMemo(() => {
    const start = parseYMDToDate(selectedStartDate)
    const end = new Date(start)
    end.setDate(start.getDate() + 13)
    return formatDateToYMD(end)
  }, [selectedStartDate])

  // Anniversary Mode Categories
  const anniversaryCategories = useMemo(() => Object.entries(anniversaryEvents.reduce<Record<string, number>>((counts, event) => {
    counts[event.category] = (counts[event.category] ?? 0) + 1
    return counts
  }, {})).map(([category, count]) => ({ category, count })).sort((left, right) => right.count - left.count), [anniversaryEvents])

  const visibleCategories = isAnniversaryMode ? anniversaryCategories : isNotesMode ? noteCategories : statistics.categories
  const visibleCount = isAnniversaryMode ? anniversaryEvents.length : isNotesMode ? noteEvents.length : statistics.eventCount
  const maxCategoryCount = Math.max(1, ...visibleCategories.map(({ count }) => count))

  const selectedEvents = useMemo(
    () => isNotesMode ? noteEvents : dailyEvents
      .filter((event) => event.date.slice(0, 7) === selectedMonth)
      .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt)),
    [dailyEvents, isNotesMode, noteEvents, selectedMonth],
  )

  const dashboardRouteKey = isAnniversaryMode
    ? `/dashboard?mode=anniversary&startDate=${selectedStartDate}`
    : isNotesMode
      ? routeForMode('/dashboard', mode)
      : `/dashboard?month=${selectedMonth}`

  useEffect(() => {
    if (!isLoading) restoreListPosition(dashboardRouteKey)
  }, [dashboardRouteKey, isLoading])

  return (
    <main className="page-enter space-y-5">
      <section className="dashboard-heading">
        <div>
          <p className="section-label !mb-1 !px-0">
            {isAnniversaryMode ? '紀念日展望' : isNotesMode ? '記事摘要' : '統計月份'}
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-stone-950 dark:text-white">
            {isAnniversaryMode ? '未來兩週紀念日' : isNotesMode ? 'Notes 摘要' : `${formatMonth(selectedMonth)} 摘要`}
          </h2>
        </div>

        {isAnniversaryMode ? (
          <div className="flex items-center gap-2">
            <label className="month-picker" title="起算日期">
              <span className="sr-only">選擇起算日期</span>
              <Calendar size={17} aria-hidden="true" />
              <input
                type="date"
                value={selectedStartDate}
                onChange={(event) => selectStartDate(event.target.value)}
              />
            </label>
            {selectedStartDate !== todayStr && (
              <button
                type="button"
                onClick={resetToToday}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 dark:border-white/10 dark:bg-stone-800 dark:text-stone-300"
              >
                今天
              </button>
            )}
          </div>
        ) : !isNotesMode ? (
          <label className="month-picker">
            <span className="sr-only">選擇統計月份</span>
            <CalendarDays size={17} aria-hidden="true" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => selectMonth(event.target.value)}
            />
          </label>
        ) : null}
      </section>

      {error ? <div className="error-notice" role="alert">{error}</div> : null}

      {isLoading ? (
        <div className="dashboard-empty">正在整理資料…</div>
      ) : isAnniversaryMode ? (
        <>
          {/* Anniversary 14-day summary */}
          <section className="dashboard-card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4 dark:border-white/10">
              <div>
                <p className="text-xs font-semibold text-stone-400">
                  {selectedStartDate === todayStr ? '今天起 14 天內' : `${selectedStartDate} 起 14 天內`}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <strong className="text-2xl font-bold tracking-tight text-stone-950 dark:text-white">
                    {upcomingAnniversaries.length}
                  </strong>
                  <span className="text-xs font-semibold text-stone-400">筆紀念日即將到來</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                <CalendarDays size={14} />
                <span>{selectedStartDate} ～ {endDateStr}</span>
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <h3 className="!mb-0 text-base font-bold text-stone-900 dark:text-white">
                兩週內紀念日日程
              </h3>
              <span className="text-xs text-stone-400 font-medium">共 {upcomingAnniversaries.length} 筆</span>
            </div>

            {upcomingAnniversaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-stone-400">
                <Gift size={28} aria-hidden="true" className="text-stone-300 dark:text-stone-600" />
                <strong className="text-stone-700 dark:text-stone-200">這兩週內沒有紀念日</strong>
                <span>可點選右上角日期選擇其他起算日期，或在 Input 新增紀念日。</span>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-white/10 mt-3">
                {upcomingAnniversaries.map((item) => {
                  const isLunar = item.event.calendarType === 'lunar'
                  return (
                    <Link
                      key={`${item.event.id}-${item.occurrenceDateStr}`}
                      className="group flex items-start justify-between gap-3 py-3.5 transition hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:hover:text-rose-300"
                      to={routeForMode(`/daily/${item.event.id}`, mode)}
                      state={{ returnTo: dashboardRouteKey, returnLabel: 'Dashboard' }}
                      data-event-id={item.event.id}
                      onClick={() => saveListPosition(dashboardRouteKey, item.event.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm font-bold text-stone-950 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-300">
                            {formatSolarDateWithWeekday(item.occurrenceDateStr)}
                          </strong>

                          {item.isToday ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 animate-pulse">
                              今天！
                            </span>
                          ) : item.isTomorrow ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                              明天
                            </span>
                          ) : (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
                              還有 {item.daysDiff} 天
                            </span>
                          )}

                          {item.anniversaryLabel && (
                            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              {item.anniversaryLabel}
                            </span>
                          )}
                        </div>

                        <h4 className="mt-1 text-base font-semibold text-stone-900 dark:text-stone-100">
                          <LinkifiedText text={item.event.title} />
                        </h4>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                          <span className={`inline-flex items-center gap-1 font-medium ${isLunar ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {isLunar ? <Moon size={12} /> : <Sun size={12} />}
                            {isLunar ? `${item.formattedLunarDate}（已換算國曆）` : '國曆'}
                          </span>
                          {item.event.detail && (
                            <span className="truncate max-w-[200px] text-stone-400">
                              · {item.event.detail}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="event-category rounded-full px-2.5 py-1 text-xs font-semibold">
                          {item.event.category}
                        </span>
                        <ChevronRight size={16} className="text-stone-300 dark:text-stone-600" aria-hidden="true" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* All Anniversaries category summary */}
          <section className="dashboard-card" aria-labelledby="anniversary-category-title">
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-stone-100 pb-4 dark:border-white/10">
              <div>
                <p className="text-xs font-semibold text-stone-400">紀念日庫存總數</p>
                <strong className="mt-1 block text-2xl font-bold tracking-tight text-stone-950 dark:text-white">
                  {anniversaryEvents.length}<small className="ml-1 text-xs font-semibold text-stone-400">筆</small>
                </strong>
              </div>
              <span className="dashboard-summary-icon !mb-0"><Heart size={19} /></span>
            </div>
            <h3 id="anniversary-category-title">類別分布</h3>
            {anniversaryCategories.length === 0 ? (
              <p className="dashboard-card-empty">目前還沒有紀念日分類。</p>
            ) : (
              <div className="stat-list mt-3">
                {anniversaryCategories.map(({ category, count }) => (
                  <div className="stat-row" key={category}>
                    <div className="stat-row-label"><span>{category}</span><strong>{count}</strong></div>
                    <div className="stat-track"><span style={{ width: `${(count / maxCategoryCount) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
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
                {selectedEvents.map((event) => {
                  const isFuture = !isNotesMode && !isAnniversaryMode && isFutureDailyEvent(event)
                  const isTodo = isNotesMode && isTodoNote(event)
                  return (
                    <Link
                      className={`dashboard-item-link flex items-center gap-3 py-3 transition focus-visible:outline-none focus-visible:ring-2 ${
                        isTodo
                          ? 'rounded-xl px-2.5 -mx-2.5 bg-rose-50/80 dark:bg-rose-950/25 border-l-4 border-rose-500'
                          : isFuture
                            ? 'rounded-xl px-2.5 -mx-2.5 bg-amber-50/70 dark:bg-amber-950/20'
                            : ''
                      }`}
                      to={routeForMode(`/daily/${event.id}`, mode)}
                      state={{ returnTo: dashboardRouteKey, returnLabel: 'Dashboard' }}
                      data-event-id={event.id}
                      onClick={() => saveListPosition(dashboardRouteKey, event.id)}
                      key={event.id}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <time className={isTodo ? "text-xs font-bold text-rose-700 dark:text-rose-400" : isFuture ? "text-xs font-bold text-amber-700 dark:text-amber-400" : "text-xs text-stone-400"} dateTime={isNotesMode ? event.lastEditedAt ?? event.updatedAt : event.date}>
                            {isNotesMode ? `修改於 ${new Date(event.lastEditedAt ?? event.updatedAt).toLocaleDateString('zh-TW')}` : event.date}
                          </time>
                          {isTodo && <span className="event-todo-badge">待做</span>}
                          {isFuture && <span className="event-future-badge">未來</span>}
                        </div>
                        <p className={`mt-1 truncate text-sm font-semibold ${isTodo ? 'text-rose-950 dark:text-rose-100 font-bold' : isFuture ? 'text-amber-950 dark:text-amber-100 font-bold' : 'text-stone-900 dark:text-stone-100'}`}><LinkifiedText text={event.title} /></p>
                      </div>
                      <span className={isTodo ? "event-category event-category-todo" : isFuture ? "event-category event-category-future" : "event-category"}>{event.category}</span>
                      <ChevronRight size={16} className={isTodo ? "shrink-0 text-rose-500 dark:text-rose-400" : isFuture ? "shrink-0 text-amber-500 dark:text-amber-400" : "shrink-0 text-stone-300 dark:text-stone-600"} aria-hidden="true" />
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
