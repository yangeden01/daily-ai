import { useMemo, useRef } from 'react'
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react'
import { toLocalDateInputValue } from '../../utils/localDate'

interface DateWheelPickerProps {
  id: string
  value: string
  onChange(value: string): void
  required?: boolean
}

const pad = (value: number) => String(value).padStart(2, '0')
const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate()

const getWeekdayZh = (dateStr: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
  return days[dt.getDay()] || ''
}

const parseDateParts = (value: string) => {
  const safeValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toLocalDateInputValue()
  const [yearStr, monthStr, dayStr] = safeValue.split('-')
  return {
    safeValue,
    year: Number(yearStr) || new Date().getFullYear(),
    month: Number(monthStr) || new Date().getMonth() + 1,
    day: Number(dayStr) || new Date().getDate(),
  }
}

export default function DateWheelPicker({ id, value, onChange, required }: DateWheelPickerProps) {
  const { safeValue, year, month, day } = parseDateParts(value)
  const weekday = useMemo(() => getWeekdayZh(safeValue), [safeValue])
  const nativeDateRef = useRef<HTMLInputElement>(null)

  const todayStr = useMemo(() => toLocalDateInputValue(new Date()), [])
  const yesterdayStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return toLocalDateInputValue(d)
  }, [])
  const dayBeforeYesterdayStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 2)
    return toLocalDateInputValue(d)
  }, [])

  const currentYear = new Date().getFullYear()
  const yearOptions = useMemo(() => {
    const start = currentYear - 30
    const end = currentYear + 10
    const list: number[] = []
    for (let y = end; y >= start; y--) {
      list.push(y)
    }
    return list
  }, [currentYear])

  const maxDays = useMemo(() => daysInMonth(year, month), [year, month])
  const dayOptions = useMemo(() => {
    return Array.from({ length: maxDays }, (_, i) => i + 1)
  }, [maxDays])

  const handleYearChange = (newYear: number) => {
    const limit = daysInMonth(newYear, month)
    const newDay = Math.min(day, limit)
    onChange(`${newYear}-${pad(month)}-${pad(newDay)}`)
  }

  const handleMonthChange = (newMonth: number) => {
    const limit = daysInMonth(year, newMonth)
    const newDay = Math.min(day, limit)
    onChange(`${year}-${pad(newMonth)}-${pad(newDay)}`)
  }

  const handleDayChange = (newDay: number) => {
    onChange(`${year}-${pad(month)}-${pad(newDay)}`)
  }

  const handleOpenNativeCalendar = () => {
    if (nativeDateRef.current) {
      try {
        if (typeof nativeDateRef.current.showPicker === 'function') {
          nativeDateRef.current.showPicker()
          return
        }
      } catch (err) {
        console.warn('showPicker error:', err)
      }
      nativeDateRef.current.focus()
      nativeDateRef.current.click()
    }
  }

  return (
    <div className="space-y-2">
      {/* 隱藏的標準原生日期 input，供驗證與系統日曆呼叫 */}
      <input
        ref={nativeDateRef}
        id={id}
        type="date"
        value={safeValue}
        onChange={(e) => {
          if (e.target.value) {
            onChange(e.target.value)
          }
        }}
        required={required}
        className="sr-only"
        aria-label="選擇事件日期"
      />

      {/* 年、月、日 下拉選擇器（直接在主畫面顯示與選取，簡化步驟跳過彈窗） */}
      <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="選擇事件日期">
        {/* 年份 */}
        <div>
          <label htmlFor={`${id}-year`} className="block text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1">
            年份
          </label>
          <div className="relative">
            <select
              id={`${id}-year`}
              value={year}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="w-full appearance-none rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-2.5 text-sm font-bold text-stone-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-white/10 dark:bg-stone-800 dark:text-stone-100 dark:focus:ring-indigo-500/20"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y} 年
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
          </div>
        </div>

        {/* 月份 */}
        <div>
          <label htmlFor={`${id}-month`} className="block text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1">
            月份
          </label>
          <div className="relative">
            <select
              id={`${id}-month`}
              value={month}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className="w-full appearance-none rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-2.5 text-sm font-bold text-stone-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-white/10 dark:bg-stone-800 dark:text-stone-100 dark:focus:ring-indigo-500/20"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {pad(m)} 月
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
          </div>
        </div>

        {/* 日期 */}
        <div>
          <label htmlFor={`${id}-day`} className="block text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1">
            日期
            {weekday && (
              <span className="ml-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                ({weekday})
              </span>
            )}
          </label>
          <div className="relative">
            <select
              id={`${id}-day`}
              value={day}
              onChange={(e) => handleDayChange(Number(e.target.value))}
              className="w-full appearance-none rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-2.5 text-sm font-bold text-stone-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-white/10 dark:bg-stone-800 dark:text-stone-100 dark:focus:ring-indigo-500/20"
            >
              {dayOptions.map((d) => (
                <option key={d} value={d}>
                  {pad(d)} 日
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
          </div>
        </div>
      </div>

      {/* 快捷日期按鈕列 */}
      <div className="flex items-center gap-1.5 pt-0.5 text-xs">
        <span className="text-stone-400 dark:text-stone-500 font-medium shrink-0">快捷：</span>
        <button
          type="button"
          onClick={() => onChange(todayStr)}
          className={`rounded-lg px-2.5 py-1 font-semibold transition ${
            safeValue === todayStr
              ? 'bg-indigo-600 text-white shadow-sm dark:bg-indigo-500'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:text-stone-300 dark:hover:bg-white/15'
          }`}
        >
          今天
        </button>
        <button
          type="button"
          onClick={() => onChange(yesterdayStr)}
          className={`rounded-lg px-2.5 py-1 font-semibold transition ${
            safeValue === yesterdayStr
              ? 'bg-indigo-600 text-white shadow-sm dark:bg-indigo-500'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:text-stone-300 dark:hover:bg-white/15'
          }`}
        >
          昨天
        </button>
        <button
          type="button"
          onClick={() => onChange(dayBeforeYesterdayStr)}
          className={`rounded-lg px-2.5 py-1 font-semibold transition ${
            safeValue === dayBeforeYesterdayStr
              ? 'bg-indigo-600 text-white shadow-sm dark:bg-indigo-500'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:text-stone-300 dark:hover:bg-white/15'
          }`}
        >
          前天
        </button>
        <button
          type="button"
          onClick={handleOpenNativeCalendar}
          className="ml-auto flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-1"
        >
          <CalendarIcon size={12} />
          系統日曆
        </button>
      </div>
    </div>
  )
}
