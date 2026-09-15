import { CalendarDays } from 'lucide-react'
import { toLocalDateInputValue } from '../../utils/localDate'

interface DateWheelPickerProps {
  id: string
  value: string
  onChange(value: string): void
  required?: boolean
}

const parseDate = (value: string) => {
  const safeValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toLocalDateInputValue()
  const [year, month, day] = safeValue.split('-')
  return { safeValue, year, month, day }
}

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate()
const pad = (value: number) => String(value).padStart(2, '0')

export default function DateWheelPicker({ id, value, onChange, required }: DateWheelPickerProps) {
  const { safeValue, year, month, day } = parseDate(value)
  const selectedMonth = `${year}-${month}`
  const lastDay = daysInMonth(Number(year), Number(month))
  const monthStart = `${selectedMonth}-01`
  const monthEnd = `${selectedMonth}-${pad(lastDay)}`

  const changeMonth = (nextMonth: string) => {
    if (!/^\d{4}-\d{2}$/.test(nextMonth)) return
    const [nextYear, nextMonthNumber] = nextMonth.split('-').map(Number)
    const nextDay = Math.min(Number(day), daysInMonth(nextYear, nextMonthNumber))
    onChange(`${nextMonth}-${pad(nextDay)}`)
  }

  return (
    <div className="date-picker-steps" role="group" aria-label="事件日期">
      <label className="date-picker-step" htmlFor={`${id}-month`}>
        <CalendarDays size={20} aria-hidden="true" />
        <span>
          <small>選擇年月</small>
          <strong>{year}年{month}月</strong>
        </span>
        <input
          id={`${id}-month`}
          type="month"
          value={selectedMonth}
          onChange={(event) => changeMonth(event.target.value)}
          aria-label="選擇事件年月"
        />
      </label>

      <label className="date-picker-step date-picker-day" htmlFor={id}>
        <span>
          <small>選擇日</small>
          <strong>{Number(day)}日</strong>
        </span>
        <input
          id={id}
          type="date"
          value={safeValue}
          min={monthStart}
          max={monthEnd}
          onChange={(event) => onChange(event.target.value)}
          aria-label="選擇事件日期"
          required={required}
        />
      </label>
    </div>
  )
}
