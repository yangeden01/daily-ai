import { describe, expect, it } from 'vitest'
import { appModeFromSearch, routeForMode } from './appMode'

describe('appMode', () => {
  it('defaults to Daily and recognizes Notes', () => {
    expect(appModeFromSearch('')).toBe('daily')
    expect(appModeFromSearch('?mode=notes')).toBe('notes')
  })

  it('preserves unrelated query parameters while switching mode', () => {
    expect(routeForMode('/ai', 'notes', '?q=日本')).toBe('/ai?q=%E6%97%A5%E6%9C%AC&mode=notes')
    expect(routeForMode('/ai', 'daily', '?q=日本&mode=notes')).toBe('/ai?q=%E6%97%A5%E6%9C%AC')
  })
})
