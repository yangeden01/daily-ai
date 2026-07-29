import { describe, expect, it } from 'vitest'
import { DEFAULT_APPEARANCE, normalizeAppearance } from './appearance'

describe('normalizeAppearance', () => {
  it('accepts supported background and text choices', () => {
    expect(normalizeAppearance({ background: 'paper', text: 'serif' })).toEqual({ background: 'paper', text: 'serif' })
  })

  it('falls back safely for missing or unsupported choices', () => {
    expect(normalizeAppearance(null)).toEqual(DEFAULT_APPEARANCE)
    expect(normalizeAppearance({ background: 'neon', text: 'comic' })).toEqual(DEFAULT_APPEARANCE)
  })
})
