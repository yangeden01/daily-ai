import { useMemo, useRef } from 'react'
import { Calendar as CalendarIcon, CalendarDays } from 'lucide-react'
import { toLocalDateInputValue } from '../../utils/localDate'

interface DateWheelPickerProps {
  id: string
  value: string
  onChange(value: string): void
  required?: boolean
}

const pad = (value: number) => String(value).padStart(2, '0')

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
    <div className="relative">
      {/* 隱藏的原生日期 input，覆蓋整張卡片，點擊任意處均可原生呼叫系統日曆 */}
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
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        aria-label="點擊開啟系統日曆修改日期"
      />

      {/* 主畫面精簡日期卡片：直接顯示當天日期 + 加大「系統日曆」Icon */}
      <div
        onClick={handleOpenNativeCalendar}
        className="group flex min-h-[58px] cursor-pointer items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 shadow-xs transition hover:border-indigo-400 hover:bg-stone-100/60 active:scale-[0.99] dark:border-white/10 dark:bg-stone-800/90 dark:hover:border-indigo-500/50 dark:hover:bg-stone-800"
        role="button"
        tabIndex={0}
        aria-label={`目前日期：${year}年${pad(month)}月${pad(day)}日 ${weekday}，點擊開啟系統日曆`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleOpenNativeCalendar()
          }
        }}
      >
        {/* 左側：直接秀當前選定/當天日期 */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:scale-105 dark:bg-indigo-500/15 dark:text-indigo-400">
            <CalendarDays size={22} aria-hidden="true" />
          </div>
          <div className="text-base font-bold text-stone-900 dark:text-stone-100 sm:text-[17px]">
            <span>{year}年{pad(month)}月{pad(day)}日</span>
            {weekday && (
              <span className="ml-2 inline-block rounded-md bg-stone-200/70 px-1.5 py-0.5 text-xs font-semibold text-stone-700 dark:bg-white/10 dark:text-stone-300">
                {weekday}
              </span>
            )}
          </div>
        </div>

        {/* 右側：加大「系統日曆」icon 與標籤按鈕 */}
        <div className="flex items-center gap-2 rounded-xl bg-indigo-100/80 px-3.5 py-2 text-indigo-700 transition group-hover:bg-indigo-200/80 dark:bg-indigo-500/20 dark:text-indigo-300 dark:group-hover:bg-indigo-500/30">
          <CalendarIcon size={22} className="shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          <span className="text-sm font-bold tracking-wide">系統日曆</span>
        </div>
      </div>
    </div>
  )
}
