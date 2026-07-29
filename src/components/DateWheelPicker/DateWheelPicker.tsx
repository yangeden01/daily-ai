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

export default function DateWheelPicker({ id, value, onChange, required }: DateWheelPickerProps) {
  const { safeValue, year, month, day } = parseDate(value)

  return (
    <label className="date-picker-trigger date-picker-native" htmlFor={id}>
      <span>{year}年{month}月{day}日</span>
      <CalendarDays size={21} aria-hidden="true" />
      <input
        id={id}
        type="date"
        value={safeValue}
        onChange={(event) => onChange(event.target.value)}
        aria-label="事件日期"
        required={required}
      />
    </label>
  )
}
