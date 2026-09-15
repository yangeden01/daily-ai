export type InstallPlatform = 'ios-safari' | 'ios-browser' | 'android' | 'standard' | 'unsupported'

interface DisplayEnvironment {
  userAgent: string
  standaloneMedia: boolean
  iosStandalone?: boolean
  supportsInstallPrompt: boolean
}

export const getInstallPlatform = ({ userAgent, supportsInstallPrompt }: DisplayEnvironment): InstallPlatform => {
  const isIOS = /iPad|iPhone|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent))
  if (isIOS) {
    const isAlternativeIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(userAgent)
    return isAlternativeIOSBrowser ? 'ios-browser' : 'ios-safari'
  }
  if (supportsInstallPrompt) return 'standard'
  return /Android/i.test(userAgent) ? 'android' : 'unsupported'
}

export const isStandaloneDisplay = ({ standaloneMedia, iosStandalone }: DisplayEnvironment): boolean =>
  standaloneMedia || iosStandalone === true

export const isIframeEnvironment = (): boolean => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top
  } catch {
    return true
  }
}

export const shouldShowInstallExperience = (installed: boolean, standalone: boolean): boolean =>
  !installed && !standalone

