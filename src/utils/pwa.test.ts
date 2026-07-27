import { describe, expect, it } from 'vitest'
import { getInstallPlatform, isStandaloneDisplay, shouldShowInstallExperience } from './pwa'

describe('PWA state logic', () => {
  it('detects iPhone and iPadOS install guidance', () => {
    expect(getInstallPlatform({ userAgent: 'Mozilla/5.0 (iPhone)', standaloneMedia: false, supportsInstallPrompt: false })).toBe('ios')
    expect(getInstallPlatform({ userAgent: 'Macintosh Mobile', standaloneMedia: false, supportsInstallPrompt: false })).toBe('ios')
  })

  it('detects standard prompt support and standalone modes', () => {
    expect(getInstallPlatform({ userAgent: 'Windows', standaloneMedia: false, supportsInstallPrompt: true })).toBe('standard')
    expect(isStandaloneDisplay({ userAgent: '', standaloneMedia: true, supportsInstallPrompt: false })).toBe(true)
    expect(isStandaloneDisplay({ userAgent: '', standaloneMedia: false, iosStandalone: true, supportsInstallPrompt: false })).toBe(true)
  })

  it('hides install experiences after installation or in standalone mode', () => {
    expect(shouldShowInstallExperience(false, false)).toBe(true)
    expect(shouldShowInstallExperience(true, false)).toBe(false)
    expect(shouldShowInstallExperience(false, true)).toBe(false)
  })
})
