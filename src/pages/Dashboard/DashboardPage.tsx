import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CircleDollarSign, Inbox, LayoutGrid } from 'lucide-react'
import type { Event } from '../../models/Event'
import { eventRepository } from '../../repositories'
import { calculateEventStatistics } from '../../utils/calculateEventStatistics'

const currentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const formatCurrency = new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  currencyDisplay: 'code',
  maximumFractionDigits: 0,
})

const formatMonth = (month: string) => {
  const [year, monthNumber] = month.split('-')
  return `${year}/${monthNumber}`
}

export default function DashboardPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    eventRepository.getAll()
      .then(setEvents)
      .catch(() => setError('暫時無法讀取統計資料，請稍後再試。'))
      .finally(() => setIsLoading(false))
  }, [])

  const statistics = useMemo(
    () => calculateEventStatistics(events, selectedMonth),
    [events, selectedMonth],
  )
  const maxCategoryCount = Math.max(1, ...statistics.categories.map(({ count }) => count))
  const maxMonthlyCount = Math.max(1, ...statistics.recentMonths.map(({ count }) => count))

  return (
    <main className="page-enter space-y-5">
      <section className="dashboard-heading">
        <div>
          <p className="section-label !mb-1 !px-0">統計月份</p>
          <h2 className="text-2xl font-bold tracking-tight text-stone-950 dark:text-white">
            {formatMonth(selectedMonth)} 摘要
          </h2>
        </div>
        <label className="month-picker">
          <span className="sr-only">選擇統計月份</span>
          <CalendarDays size={17} aria-hidden="true" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value || currentMonth())}
          />
        </label>
      </section>

      {error ? <div className="error-notice" role="alert">{error}</div> : null}

      {isLoading ? (
        <div className="dashboard-empty">正在整理事件統計…</div>
      ) : (
        <>
          <section className="dashboard-summary-grid" aria-label="月份摘要">
            <article className="dashboard-summary-card">
              <span className="dashboard-summary-icon"><LayoutGrid size={19} /></span>
              <p>本月事件</p>
              <strong>{statistics.eventCount}<small> 筆</small></strong>
            </article>
            <article className="dashboard-summary-card">
              <span className="dashboard-summary-icon"><CircleDollarSign size={19} /></span>
              <p>本月金額</p>
              <strong>{formatCurrency.format(statistics.amountTotal)}</strong>
            </article>
          </section>

          {statistics.eventCount === 0 ? (
            <section className="dashboard-empty">
              <Inbox size={28} aria-hidden="true" />
              <strong>這個月份還沒有事件</strong>
              <span>新增事件後，統計會自動出現在這裡。</span>
            </section>
          ) : (
            <section className="dashboard-card">
              <h3>Category 分布</h3>
              <div className="stat-list">
                {statistics.categories.map(({ category, count }) => (
                  <div className="stat-row" key={category}>
                    <div className="stat-row-label"><span>{category}</span><strong>{count}</strong></div>
                    <div className="stat-track"><span style={{ width: `${(count / maxCategoryCount) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="dashboard-card">
            <h3>最近 6 個月</h3>
            {statistics.recentMonths.every(({ count }) => count === 0) ? (
              <p className="dashboard-card-empty">最近六個月尚無事件資料。</p>
            ) : (
              <div className="stat-list">
                {statistics.recentMonths.map(({ month, count }) => (
                  <div className="stat-row" key={month}>
                    <div className="stat-row-label"><span>{formatMonth(month)}</span><strong>{count}</strong></div>
                    <div className="stat-track stat-track-secondary"><span style={{ width: `${(count / maxMonthlyCount) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
