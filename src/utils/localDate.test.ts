import { describe, expect, it } from 'vitest'
import { toLocalDateInputValue } from './localDate'

describe('toLocalDateInputValue', () => {
  it('formats the calendar date from local components', () => {
    const localMidnight = new Date(2026, 0, 2, 0, 5)

    expect(toLocalDateInputValue(localMidnight)).toBe('2026-01-02')
  })

  it('pads single-digit months and days for a native date input', () => {
    expect(toLocalDateInputValue(new Date(2026, 8, 7, 23, 59))).toBe('2026-09-07')
  })
})
