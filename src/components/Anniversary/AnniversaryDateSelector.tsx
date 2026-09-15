import { useMemo } from 'react'
import type { CalendarType } from '../../models/Event'
import {
  SOLAR_MONTH_NAMES,
  getDaysInSolarMonth,
  parseSolarMonthDay,
  LUNAR_MONTH_NAMES,
  LUNAR_DAY_NAMES,
  convertLunarToSolarYMD,
  formatSolarDateWithWeekday,
  getLunarFromSolarYMD,
} from '../../utils/anniversary'
import { Calendar, Moon, Sparkles } from 'lucide-react'

interface AnniversaryDateSelectorProps {
  calendarType: CalendarType
  onCalendarTypeChange: (type: CalendarType) => void
  solarDate: string
  onSolarDateChange: (date: string) => void
  lunarMonth: number
  onLunarMonthChange: (month: number) => void
  lunarDay: number
  onLunarDayChange: (day: number) => void
  isLeapMonth: boolean
  onIsLeapMonthChange: (isLeap: boolean) => void
}

export function AnniversaryDateSelector({
  calendarType,
  onCalendarTypeChange,
  solarDate,
  onSolarDateChange,
  lunarMonth,
  onLunarMonthChange,
  lunarDay,
  onLunarDayChange,
  isLeapMonth,
  onIsLeapMonthChange,
}: AnniversaryDateSelectorProps) {
  const currentYear = new Date().getFullYear()

  // Parse current solar month and day
  const { month: solarMonth, day: solarDay } = useMemo(
    () => parseSolarMonthDay(solarDate),
    [solarDate]
  )

  const solarMaxDays = useMemo(() => getDaysInSolarMonth(solarMonth), [solarMonth])
  const solarDayOptions = useMemo(
    () => Array.from({ length: solarMaxDays }, (_, i) => i + 1),
    [solarMaxDays]
  )

  const handleSolarMonthChange = (newMonth: number) => {
    const maxDays = getDaysInSolarMonth(newMonth)
    const newDay = Math.min(solarDay, maxDays)
    onSolarDateChange(`${String(newMonth).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`)
  }

  const handleSolarDayChange = (newDay: number) => {
    onSolarDateChange(`${String(solarMonth).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`)
  }

  // Calculate current year's solar equivalent
  const liveSolarFormatted = useMemo(() => {
    if (calendarType === 'lunar') {
      const convertedYMD = convertLunarToSolarYMD(currentYear, lunarMonth, lunarDay, isLeapMonth)
      if (!convertedYMD) return null
      return formatSolarDateWithWeekday(convertedYMD)
    }
    const mStr = String(solarMonth).padStart(2, '0')
    const dStr = String(solarDay).padStart(2, '0')
    return formatSolarDateWithWeekday(`${currentYear}-${mStr}-${dStr}`)
  }, [calendarType, currentYear, lunarMonth, lunarDay, isLeapMonth, solarMonth, solarDay])

  return (
    <div className="space-y-3 rounded-2xl border border-stone-200 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-stone-900/60">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          曆法類型
        </label>
        <div className="grid grid-cols-2 rounded-xl bg-stone-100 p-1 text-xs font-semibold dark:bg-white/10" role="group">
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              calendarType === 'solar'
                ? 'bg-white text-rose-600 shadow-sm dark:bg-stone-800 dark:text-rose-300'
                : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
            onClick={() => {
              if (calendarType !== 'solar') {
                const solarYMD = convertLunarToSolarYMD(currentYear, lunarMonth, lunarDay, isLeapMonth)
                if (solarYMD) {
                  const parts = solarYMD.split('-')
                  onSolarDateChange(`${parts[1]}-${parts[2]}`)
                }
                onCalendarTypeChange('solar')
              }
            }}
          >
            <Calendar size={13} />
            國曆 (陽曆)
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              calendarType === 'lunar'
                ? 'bg-white text-rose-600 shadow-sm dark:bg-stone-800 dark:text-rose-300'
                : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
            onClick={() => {
              if (calendarType !== 'lunar') {
                const converted = getLunarFromSolarYMD(solarDate)
                onLunarMonthChange(converted.month)
                onLunarDayChange(converted.day)
                onIsLeapMonthChange(converted.isLeap)
                onCalendarTypeChange('lunar')
              }
            }}
          >
            <Moon size={13} />
            農曆 (陰曆)
          </button>
        </div>
      </div>

      {calendarType === 'solar' ? (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-stone-600 dark:text-stone-300">
                國曆月份
              </label>
              <select
                className="w-full appearance-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-800 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100 dark:border-white/10 dark:bg-stone-800 dark:text-stone-100 dark:focus:ring-rose-500/20"
                value={solarMonth}
                onChange={(e) => handleSolarMonthChange(Number(e.target.value))}
              >
                {SOLAR_MONTH_NAMES.map((name, index) => (
                  <option key={index + 1} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-stone-600 dark:text-stone-300">
                國曆日期
              </label>
              <select
                className="w-full appearance-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-800 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100 dark:border-white/10 dark:bg-stone-800 dark:text-stone-100 dark:focus:ring-rose-500/20"
                value={solarDay}
                onChange={(e) => handleSolarDayChange(Number(e.target.value))}
              >
                {solarDayOptions.map((dayNum) => (
                  <option key={dayNum} value={dayNum}>
                    {dayNum}日
                  </option>
                ))}
              </select>
            </div>
          </div>

          {liveSolarFormatted && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50/70 p-2.5 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              <Sparkles size={14} className="shrink-0 text-rose-500" />
              <span>
                今年 ({currentYear}) 紀念日：
                <strong className="ml-1 font-bold text-rose-900 dark:text-rose-200">
                  {liveSolarFormatted}
                </strong>
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-stone-600 dark:text-stone-300">
                農曆月份
              </label>
              <select
                className="w-full appearance-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-800 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100 dark:border-white/10 dark:bg-stone-800 dark:text-stone-100 dark:focus:ring-rose-500/20"
                value={lunarMonth}
                onChange={(e) => onLunarMonthChange(Number(e.target.value))}
              >
                {LUNAR_MONTH_NAMES.map((name, index) => (
                  <option key={index + 1} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-stone-600 dark:text-stone-300">
                農曆日期
              </label>
              <select
                className="w-full appearance-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-800 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100 dark:border-white/10 dark:bg-stone-800 dark:text-stone-100 dark:focus:ring-rose-500/20"
                value={lunarDay}
                onChange={(e) => onLunarDayChange(Number(e.target.value))}
              >
                {LUNAR_DAY_NAMES.map((name, index) => (
                  <option key={index + 1} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-stone-700 dark:text-stone-300">
              <input
                type="checkbox"
                checked={isLeapMonth}
                onChange={(e) => onIsLeapMonthChange(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500"
              />
              閏月 (若該年有閏月才生效)
            </label>
          </div>

          {liveSolarFormatted && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50/70 p-2.5 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              <Sparkles size={14} className="shrink-0 text-rose-500" />
              <span>
                今年 ({currentYear}) 對應國曆：
                <strong className="ml-1 font-bold text-rose-900 dark:text-rose-200">
                  {liveSolarFormatted}
                </strong>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

