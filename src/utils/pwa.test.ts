import { describe, expect, it } from 'vitest'
import { getInstallPlatform, isStandaloneDisplay, shouldShowInstallExperience } from './pwa'

describe('PWA state logic', () => {
  it('detects iPhone and iPadOS install guidance', () => {
    expect(getInstallPlatform({ userAgent: 'Mozilla/5.0 (iPhone) Version/18.0 Mobile Safari/604.1', standaloneMedia: false, supportsInstallPrompt: false })).toBe('ios-safari')
    expect(getInstallPlatform({ userAgent: 'Macintosh Mobile Safari', standaloneMedia: false, supportsInstallPrompt: false })).toBe('ios-safari')
    expect(getInstallPlatform({ userAgent: 'Mozilla/5.0 (iPhone) CriOS/126.0 Mobile Safari/604.1', standaloneMedia: false, supportsInstallPrompt: false })).toBe('ios-browser')
  })

  it('detects Android fallback guidance and standard prompt support', () => {
    expect(getInstallPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/126 Mobile', standaloneMedia: false, supportsInstallPrompt: false })).toBe('android')
    expect(getInstallPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/126 Mobile', standaloneMedia: false, supportsInstallPrompt: true })).toBe('standard')
    expect(getInstallPlatform({ userAgent: 'Windows', standaloneMedia: false, supportsInstallPrompt: true })).toBe('standard')
  })

  it('detects standalone modes', () => {
    expect(isStandaloneDisplay({ userAgent: '', standaloneMedia: true, supportsInstallPrompt: false })).toBe(true)
    expect(isStandaloneDisplay({ userAgent: '', standaloneMedia: false, iosStandalone: true, supportsInstallPrompt: false })).toBe(true)
  })

  it('hides install experiences after installation or in standalone mode', () => {
    expect(shouldShowInstallExperience(false, false)).toBe(true)
    expect(shouldShowInstallExperience(true, false)).toBe(false)
    expect(shouldShowInstallExperience(false, true)).toBe(false)
  })
})
