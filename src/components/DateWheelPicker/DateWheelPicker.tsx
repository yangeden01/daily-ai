import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Calendar as CalendarIcon, Check, X, ChevronDown } from 'lucide-react'
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

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [tempYear, setTempYear] = useState(year)
  const [tempMonth, setTempMonth] = useState(month)
  const [tempDay, setTempDay] = useState(day)

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

  const maxDays = useMemo(() => daysInMonth(tempYear, tempMonth), [tempYear, tempMonth])
  const dayOptions = useMemo(() => {
    return Array.from({ length: maxDays }, (_, i) => i + 1)
  }, [maxDays])

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isModalOpen])

  const openModal = () => {
    const parts = parseDateParts(value)
    setTempYear(parts.year)
    setTempMonth(parts.month)
    setTempDay(Math.min(parts.day, daysInMonth(parts.year, parts.month)))
    setIsModalOpen(true)
  }

  const handleYearChange = (newYear: number) => {
    setTempYear(newYear)
    const limit = daysInMonth(newYear, tempMonth)
    if (tempDay > limit) {
      setTempDay(limit)
    }
  }

  const handleMonthChange = (newMonth: number) => {
    setTempMonth(newMonth)
    const limit = daysInMonth(tempYear, newMonth)
    if (tempDay > limit) {
      setTempDay(limit)
    }
  }

  const handleConfirm = () => {
    const finalDate = `${tempYear}-${pad(tempMonth)}-${pad(tempDay)}`
    onChange(finalDate)
    setIsModalOpen(false)
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

  const tempDateStr = `${tempYear}-${pad(tempMonth)}-${pad(tempDay)}`
  const tempWeekday = useMemo(() => getWeekdayZh(tempDateStr), [tempDateStr])

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
            setIsModalOpen(false)
          }
        }}
        required={required}
        className="sr-only"
        aria-label="選擇事件日期"
      />

      {/* 主顯示卡片：左側「選擇年月」、右側「選擇日」 */}
      <div className="date-picker-steps" role="group" aria-label="事件日期">
        <button
          type="button"
          onClick={openModal}
          className="date-picker-step text-left"
          aria-label={`選擇年月，目前為 ${year}年${month}月`}
        >
          <CalendarDays size={20} aria-hidden="true" />
          <span>
            <small className="flex items-center gap-1">
              選擇年月 <ChevronDown size={12} className="opacity-60" />
            </small>
            <strong>{year}年{pad(month)}月</strong>
          </span>
        </button>

        <button
          type="button"
          onClick={openModal}
          className="date-picker-step date-picker-day text-center"
          aria-label={`選擇日，目前為 ${day}日 ${weekday}`}
        >
          <span>
            <small className="flex items-center justify-center gap-1">
              選擇日 <ChevronDown size={12} className="opacity-60" />
            </small>
            <strong>
              {day}日 <span className="text-[11px] font-normal opacity-70">({weekday})</span>
            </strong>
          </span>
        </button>
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

      {/* 互動式日期調整彈窗（透過 createPortal 掛載至 document.body，置中顯示，保證 100% 正常彈出） */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 p-5 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 彈窗標題列 */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100">選擇事件日期</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-white/10 dark:hover:text-stone-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* 即時預覽卡片 */}
            <div className="my-4 rounded-2xl bg-indigo-50/70 p-3 text-center dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">目前選取日期</div>
              <div className="text-lg font-bold text-indigo-950 dark:text-indigo-200 mt-0.5">
                {tempYear} 年 {pad(tempMonth)} 月 {pad(tempDay)} 日
                <span className="ml-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  ({tempWeekday})
                </span>
              </div>
            </div>

            {/* 年、月、日 下拉/滾輪選擇器（呼叫手機系統原生滾輪） */}
            <div className="grid grid-cols-3 gap-2.5 my-4">
              {/* 年份 */}
              <div>
                <label className="block text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1">
                  年份
                </label>
                <div className="relative">
                  <select
                    value={tempYear}
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
                <label className="block text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1">
                  月份
                </label>
                <div className="relative">
                  <select
                    value={tempMonth}
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
                <label className="block text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1">
                  日期
                </label>
                <div className="relative">
                  <select
                    value={tempDay}
                    onChange={(e) => setTempDay(Number(e.target.value))}
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

            {/* 彈窗內快捷選項 */}
            <div className="flex items-center justify-between pt-1 pb-3 text-xs border-b border-stone-100 dark:border-white/10">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const p = parseDateParts(todayStr)
                    setTempYear(p.year)
                    setTempMonth(p.month)
                    setTempDay(p.day)
                  }}
                  className="rounded-lg bg-stone-100 px-2.5 py-1 font-semibold text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:text-stone-300"
                >
                  今天
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = parseDateParts(yesterdayStr)
                    setTempYear(p.year)
                    setTempMonth(p.month)
                    setTempDay(p.day)
                  }}
                  className="rounded-lg bg-stone-100 px-2.5 py-1 font-semibold text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:text-stone-300"
                >
                  昨天
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = parseDateParts(dayBeforeYesterdayStr)
                    setTempYear(p.year)
                    setTempMonth(p.month)
                    setTempDay(p.day)
                  }}
                  className="rounded-lg bg-stone-100 px-2.5 py-1 font-semibold text-stone-600 hover:bg-stone-200 dark:bg-white/10 dark:text-stone-300"
                >
                  前天
                </button>
              </div>

              <button
                type="button"
                onClick={handleOpenNativeCalendar}
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                <CalendarIcon size={13} />
                系統日曆
              </button>
            </div>

            {/* 確定與取消按鈕 */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-stone-200 py-2.5 text-sm font-bold text-stone-600 hover:bg-stone-50 dark:border-white/10 dark:text-stone-300 dark:hover:bg-white/5"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-[0.98] transition dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                <Check size={16} />
                確定選取
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}


