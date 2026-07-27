export type InstallPlatform = 'ios' | 'standard' | 'unsupported'

interface DisplayEnvironment {
  userAgent: string
  standaloneMedia: boolean
  iosStandalone?: boolean
  supportsInstallPrompt: boolean
}

export const getInstallPlatform = ({ userAgent, supportsInstallPrompt }: DisplayEnvironment): InstallPlatform => {
  const isIOS = /iPad|iPhone|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent))
  if (isIOS) return 'ios'
  return supportsInstallPrompt ? 'standard' : 'unsupported'
}

export const isStandaloneDisplay = ({ standaloneMedia, iosStandalone }: DisplayEnvironment): boolean =>
  standaloneMedia || iosStandalone === true

export const shouldShowInstallExperience = (installed: boolean, standalone: boolean): boolean =>
  !installed && !standalone
