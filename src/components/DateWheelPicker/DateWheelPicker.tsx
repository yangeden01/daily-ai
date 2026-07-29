import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
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
const WHEEL_ITEM_HEIGHT = 48

interface WheelColumnProps {
  label: string
  values: number[]
  value: number
  onChange(value: number): void
  wheelRef: RefObject<HTMLDivElement | null>
}

function WheelColumn({ label, values, value, onChange, wheelRef }: WheelColumnProps) {
  const selectFromScroll = () => {
    const wheel = wheelRef.current
    if (!wheel) return
    const index = Math.max(0, Math.min(values.length - 1, Math.round(wheel.scrollTop / WHEEL_ITEM_HEIGHT)))
    onChange(values[index])
  }

  const selectValue = (nextValue: number) => {
    onChange(nextValue)
    const index = values.indexOf(nextValue)
    wheelRef.current?.scrollTo({ top: index * WHEEL_ITEM_HEIGHT, behavior: 'smooth' })
  }

  return (
    <div className="date-wheel-column">
      <span id={`date-wheel-${label}`}>{label}</span>
      <div
        ref={wheelRef}
        className="date-wheel-scroll"
        role="listbox"
        aria-labelledby={`date-wheel-${label}`}
        aria-activedescendant={`date-wheel-${label}-${value}`}
        tabIndex={0}
        onScroll={selectFromScroll}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
          event.preventDefault()
          const currentIndex = values.indexOf(value)
          const nextIndex = Math.max(0, Math.min(values.length - 1, currentIndex + (event.key === 'ArrowDown' ? 1 : -1)))
          selectValue(values[nextIndex])
        }}
      >
        {values.map((option) => (
          <button
            id={`date-wheel-${label}-${option}`}
            type="button"
            role="option"
            aria-selected={option === value}
            className="date-wheel-option"
            onClick={() => selectValue(option)}
            key={option}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function DateWheelPicker({ id, value, onChange, required }: DateWheelPickerProps) {
  const initial = parseDate(value)
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [day, setDay] = useState(initial.day)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const yearSelectRef = useRef<HTMLDivElement>(null)
  const monthSelectRef = useRef<HTMLDivElement>(null)
  const daySelectRef = useRef<HTMLDivElement>(null)
  const currentYear = new Date().getFullYear()
  const years = useMemo(() => Array.from({ length: currentYear - 1899 + 20 }, (_, index) => 1900 + index), [currentYear])
  const days = useMemo(() => Array.from({ length: daysInMonth(year, month) }, (_, index) => index + 1), [month, year])

  useEffect(() => {
    if (day > days.length) setDay(days.length)
  }, [day, days.length])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    const previousOverscrollBehavior = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.overscrollBehavior = previousOverscrollBehavior
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      const scrollTimer = window.setTimeout(() => {
        for (const [wheel, values, selectedValue] of [
          [yearSelectRef.current, years, year],
          [monthSelectRef.current, Array.from({ length: 12 }, (_, index) => index + 1), month],
          [daySelectRef.current, days, day],
        ] as const) {
          if (!wheel) continue
          wheel.scrollTop = Math.max(0, values.indexOf(selectedValue) * WHEEL_ITEM_HEIGHT)
        }
      }, 50)
      return () => window.clearTimeout(scrollTimer)
    }
    if (!open && dialog.open) dialog.close()
  }, [day, days, month, open, year, years])

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

      {createPortal(
        <dialog ref={dialogRef} className="date-picker-modal" onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
          <div className="date-picker-modal-shell" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
          <section className="date-picker-dialog" aria-labelledby={`${id}-title`}>
            <h2 id={`${id}-title`}>設定日期</h2>
            <div className="date-wheel-grid">
              <div className="date-wheel-selection" aria-hidden="true" />
              <WheelColumn label="年" values={years} value={year} onChange={setYear} wheelRef={yearSelectRef} />
              <WheelColumn label="月" values={Array.from({ length: 12 }, (_, index) => index + 1)} value={month} onChange={setMonth} wheelRef={monthSelectRef} />
              <WheelColumn label="日" values={days} value={day} onChange={setDay} wheelRef={daySelectRef} />
            </div>
            <div className="date-picker-actions">
              <button type="button" onClick={() => setOpen(false)}>取消</button>
              <button type="button" className="date-picker-confirm" onClick={apply}>設定</button>
            </div>
          </section>
          </div>
        </dialog>,
        document.body,
      )}
    </>
  )
}
