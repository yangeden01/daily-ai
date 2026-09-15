import { beforeEach, describe, expect, it } from 'vitest'
import { clearTabDestination, getTabDestination, rememberTabDestination, tabBaseForReturnTo } from './tabNavigationMemory'

beforeEach(() => ['/daily', '/ai', '/dashboard'].forEach(clearTabDestination))

describe('tab navigation memory', () => {
  it('remembers an event detail destination for its source tab', () => {
    rememberTabDestination('/ai', {
      pathname: '/daily/event-1', search: '', state: { returnTo: '/ai?q=所得稅', returnLabel: 'Search' },
    })
    expect(getTabDestination('/ai')).toMatchObject({ pathname: '/daily/event-1', state: { returnTo: '/ai?q=所得稅' } })
  })

  it('maps event return routes to the correct tab', () => {
    expect(tabBaseForReturnTo('/ai?q=日本')).toBe('/ai')
    expect(tabBaseForReturnTo('/dashboard?month=2026-07')).toBe('/dashboard')
    expect(tabBaseForReturnTo('/daily')).toBe('/daily')
  })
})
