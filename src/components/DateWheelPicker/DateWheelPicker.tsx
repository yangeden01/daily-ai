import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarDays,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  ChevronDown
} from 'lucide-react'
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

  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [viewYear, setViewYear] = useState(year)
  const [viewMonth, setViewMonth] = useState(month)

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

  // When opening calendar, sync viewYear/viewMonth to current value
  const handleOpenCalendar = () => {
    const parts = parseDateParts(value)
    setViewYear(parts.year)
    setViewMonth(parts.month)
    setIsCalendarOpen(true)
  }

  // Prevent background scroll when calendar modal is open
  useEffect(() => {
    if (isCalendarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isCalendarOpen])

  // Year choices for quick selection in calendar
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

  // Calendar calculations
  const firstDayOfWeek = useMemo(() => {
    return new Date(viewYear, viewMonth - 1, 1).getDay() // 0 = Sunday, 1 = Monday...
  }, [viewYear, viewMonth])

  const totalDaysInViewMonth = useMemo(() => {
    return daysInMonth(viewYear, viewMonth)
  }, [viewYear, viewMonth])

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1)
      setViewMonth(12)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1)
      setViewMonth(1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const handleSelectDay = (selectedDay: number) => {
    const formatted = `${viewYear}-${pad(viewMonth)}-${pad(selectedDay)}`
    onChange(formatted)
    setIsCalendarOpen(false)
  }

  const handleQuickSelect = (dateStr: string) => {
    onChange(dateStr)
    const p = parseDateParts(dateStr)
    setViewYear(p.year)
    setViewMonth(p.month)
    setIsCalendarOpen(false)
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
      {/* 隱藏的標準原生日期 input，供表單驗證 */}
      <input
        ref={nativeDateRef}
        id={id}
        type="date"
        value={safeValue}
        onChange={(e) => {
          if (e.target.value) {
            onChange(e.target.value)
            setIsCalendarOpen(false)
          }
        }}
        required={required}
        className="sr-only"
        aria-label="事件日期"
      />

      {/* 主畫面精簡日期顯示卡片 */}
      <div
        onClick={handleOpenCalendar}
        className="group flex min-h-[58px] cursor-pointer items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2.5 shadow-xs transition hover:border-indigo-400 hover:bg-stone-100/60 active:scale-[0.99] dark:border-white/10 dark:bg-stone-800/90 dark:hover:border-indigo-500/50 dark:hover:bg-stone-800"
        role="button"
        tabIndex={0}
        aria-label={`目前日期：${year}年${pad(month)}月${pad(day)}日 ${weekday}，點擊修改日期`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleOpenCalendar()
          }
        }}
      >
        {/* 左側：直接秀當前選定/當天日期 */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:scale-105 dark:bg-indigo-500/15 dark:text-indigo-400">
            <CalendarDays size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] sm:text-base font-bold text-stone-900 dark:text-stone-100 whitespace-nowrap tabular-nums leading-tight">
              {year}年{pad(month)}月{pad(day)}日
            </div>
            {weekday && (
              <span className="inline-block mt-0.5 rounded-md bg-stone-200/70 px-1.5 py-0.5 text-[11px] font-semibold text-stone-700 dark:bg-white/10 dark:text-stone-300">
                {weekday}
              </span>
            )}
          </div>
        </div>

        {/* 右側：修改日期按鈕 (縮小 icon 與按鈕尺寸，確保不擠壓左側日期) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleOpenCalendar()
          }}
          className="flex items-center gap-1 rounded-xl bg-indigo-600 px-2.5 py-1.5 text-white shadow-xs transition hover:bg-indigo-700 active:scale-95 shrink-0 whitespace-nowrap dark:bg-indigo-500 dark:hover:bg-indigo-600 ml-2"
          aria-label="修改日期"
        >
          <CalendarIcon size={14} className="shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold tracking-wide">修改日期</span>
        </button>
      </div>

      {/* 互動式日曆彈窗（透過 createPortal 掛載至最上層 document.body，在 Android APK 與所有裝置 100% 正常開啟） */}
      {isCalendarOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsCalendarOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 p-5 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="選擇事件日期"
          >
            {/* 彈窗頂部：標題與關閉按鈕 */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100">修改日期</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCalendarOpen(false)}
                className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-white/10 dark:hover:text-stone-200"
                aria-label="關閉日曆"
              >
                <X size={18} />
              </button>
            </div>

            {/* 年月切換列 */}
            <div className="flex items-center justify-between my-3 px-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="rounded-xl p-2 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10 active:scale-90 transition"
                aria-label="上一月"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="flex items-center gap-2">
                {/* 年份快速下拉 */}
                <div className="relative">
                  <select
                    value={viewYear}
                    onChange={(e) => setViewYear(Number(e.target.value))}
                    className="appearance-none rounded-lg bg-stone-100 dark:bg-stone-800 pl-2.5 pr-6 py-1 text-sm font-bold text-stone-800 dark:text-stone-100 outline-none border border-transparent focus:border-indigo-500"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}年
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-400" />
                </div>

                {/* 月份快速下拉 */}
                <div className="relative">
                  <select
                    value={viewMonth}
                    onChange={(e) => setViewMonth(Number(e.target.value))}
                    className="appearance-none rounded-lg bg-stone-100 dark:bg-stone-800 pl-2.5 pr-6 py-1 text-sm font-bold text-stone-800 dark:text-stone-100 outline-none border border-transparent focus:border-indigo-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {pad(m)}月
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-400" />
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="rounded-xl p-2 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10 active:scale-90 transition"
                aria-label="下一月"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* 星期標頭 (週日 ~ 週六) */}
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-stone-400 dark:text-stone-500 mb-1.5">
              <span className="text-rose-500/80">日</span>
              <span>一</span>
              <span>二</span>
              <span>三</span>
              <span>四</span>
              <span>五</span>
              <span className="text-indigo-500/80">六</span>
            </div>

            {/* 日期網格 (7欄) */}
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {/* 月首空白格 */}
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                <div key={`blank-${idx}`} className="h-9 w-full" />
              ))}

              {/* 當月天數 1 ~ 31 */}
              {Array.from({ length: totalDaysInViewMonth }, (_, idx) => {
                const dayNum = idx + 1
                const currentCellDateStr = `${viewYear}-${pad(viewMonth)}-${pad(dayNum)}`
                const isSelected = currentCellDateStr === safeValue
                const isToday = currentCellDateStr === todayStr
                const dayOfWeek = (firstDayOfWeek + idx) % 7
                const isSunday = dayOfWeek === 0
                const isSaturday = dayOfWeek === 6

                return (
                  <button
                    key={`day-${dayNum}`}
                    type="button"
                    onClick={() => handleSelectDay(dayNum)}
                    className={`relative flex h-9 w-full items-center justify-center rounded-xl text-sm font-semibold transition active:scale-95 ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-bold shadow-md dark:bg-indigo-500'
                        : isToday
                        ? 'border border-indigo-500/70 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20'
                        : isSunday
                        ? 'text-rose-600 dark:text-rose-400 hover:bg-stone-100 dark:hover:bg-white/10'
                        : isSaturday
                        ? 'text-indigo-600 dark:text-indigo-300 hover:bg-stone-100 dark:hover:bg-white/10'
                        : 'text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/10'
                    }`}
                  >
                    {dayNum}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* 快捷切換列 (今天 / 昨天 / 前天) */}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-stone-100 dark:border-white/10 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400 dark:text-stone-500 font-medium mr-0.5">快捷：</span>
                <button
                  type="button"
                  onClick={() => handleQuickSelect(todayStr)}
                  className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                    safeValue === todayStr
                      ? 'bg-indigo-600 text-white shadow-xs dark:bg-indigo-500'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:text-stone-300'
                  }`}
                >
                  今天
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect(yesterdayStr)}
                  className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                    safeValue === yesterdayStr
                      ? 'bg-indigo-600 text-white shadow-xs dark:bg-indigo-500'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:text-stone-300'
                  }`}
                >
                  昨天
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect(dayBeforeYesterdayStr)}
                  className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                    safeValue === dayBeforeYesterdayStr
                      ? 'bg-indigo-600 text-white shadow-xs dark:bg-indigo-500'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:text-stone-300'
                  }`}
                >
                  前天
                </button>
              </div>

              <button
                type="button"
                onClick={handleOpenNativeCalendar}
                className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-1 font-semibold"
              >
                <CalendarIcon size={12} />
                系統日曆
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
