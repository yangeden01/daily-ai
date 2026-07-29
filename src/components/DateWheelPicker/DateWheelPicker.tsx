import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [year, month, day] = safeValue.split('-').map(Number)
  return { year, month, day }
}

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate()
const pad = (value: number) => String(value).padStart(2, '0')

export default function DateWheelPicker({ id, value, onChange, required }: DateWheelPickerProps) {
  const initial = parseDate(value)
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [day, setDay] = useState(initial.day)
  const currentYear = new Date().getFullYear()
  const years = useMemo(() => Array.from({ length: currentYear - 1899 + 20 }, (_, index) => 1900 + index), [currentYear])
  const days = useMemo(() => Array.from({ length: daysInMonth(year, month) }, (_, index) => index + 1), [month, year])

  useEffect(() => {
    if (day > days.length) setDay(days.length)
  }, [day, days.length])

  const show = () => {
    const selected = parseDate(value)
    setYear(selected.year)
    setMonth(selected.month)
    setDay(selected.day)
    setOpen(true)
  }

  const apply = () => {
    onChange(`${year}-${pad(month)}-${pad(day)}`)
    setOpen(false)
  }

  return (
    <>
      <button id={id} type="button" className="date-picker-trigger" onClick={show} aria-haspopup="dialog" aria-expanded={open}>
        <span>{year}年{pad(month)}月{pad(day)}日</span>
        <CalendarDays size={21} aria-hidden="true" />
      </button>
      {required && <input className="sr-only" tabIndex={-1} aria-hidden="true" value={value} required readOnly />}

      {open && createPortal(
        <div className="date-picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
          <section className="date-picker-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
            <h2 id={`${id}-title`}>設定日期</h2>
            <div className="date-wheel-grid">
              <label>
                <span>年</span>
                <select size={5} value={year} onChange={(event) => setYear(Number(event.target.value))}>
                  {years.map((option) => <option value={option} key={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span>月</span>
                <select size={5} value={month} onChange={(event) => setMonth(Number(event.target.value))}>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((option) => <option value={option} key={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span>日</span>
                <select size={5} value={day} onChange={(event) => setDay(Number(event.target.value))}>
                  {days.map((option) => <option value={option} key={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="date-picker-actions">
              <button type="button" onClick={() => setOpen(false)}>取消</button>
              <button type="button" className="date-picker-confirm" onClick={apply}>設定</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
