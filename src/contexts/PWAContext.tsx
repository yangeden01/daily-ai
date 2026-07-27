import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { getInstallPlatform, isStandaloneDisplay, shouldShowInstallExperience, type InstallPlatform } from '../utils/pwa'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type ServiceWorkerStatus = 'unsupported' | 'registering' | 'ready' | 'error'

interface PWAState {
  isOnline: boolean
  isInstalled: boolean
  isStandalone: boolean
  installPlatform: InstallPlatform
  canPromptInstall: boolean
  showInstallExperience: boolean
  serviceWorkerStatus: ServiceWorkerStatus
  updateAvailable: boolean
  install(): Promise<boolean>
  applyUpdate(): Promise<void>
  dismissUpdate(): void
}

const PWAContext = createContext<PWAState | null>(null)

const getDisplayEnvironment = (supportsInstallPrompt: boolean) => ({
  userAgent: navigator.userAgent,
  standaloneMedia: window.matchMedia('(display-mode: standalone)').matches,
  iosStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
  supportsInstallPrompt,
})

export function PWAProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState<ServiceWorkerStatus>('registering')
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateServiceWorker, setUpdateServiceWorker] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null)
  const displayEnvironment = getDisplayEnvironment(Boolean(installPrompt))
  const isStandalone = isStandaloneDisplay(displayEnvironment)
  const installPlatform = getInstallPlatform(displayEnvironment)

  useEffect(() => {
    const online = () => setIsOnline(true)
    const offline = () => setIsOnline(false)
    const installed = () => { setIsInstalled(true); setInstallPrompt(null) }
    const beforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    window.addEventListener('appinstalled', installed)
    window.addEventListener('beforeinstallprompt', beforeInstall)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      window.removeEventListener('appinstalled', installed)
      window.removeEventListener('beforeinstallprompt', beforeInstall)
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setServiceWorkerStatus('unsupported')
      return
    }
    const update = registerSW({
      immediate: true,
      onRegistered: () => setServiceWorkerStatus('ready'),
      onRegisterError: () => setServiceWorkerStatus('error'),
      onNeedRefresh: () => setUpdateAvailable(true),
    })
    setUpdateServiceWorker(() => update)
  }, [])

  const value = useMemo<PWAState>(() => ({
    isOnline,
    isInstalled: isInstalled || isStandalone,
    isStandalone,
    installPlatform,
    canPromptInstall: Boolean(installPrompt),
    showInstallExperience: shouldShowInstallExperience(isInstalled, isStandalone),
    serviceWorkerStatus,
    updateAvailable,
    install: async () => {
      if (!installPrompt) return false
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') setInstallPrompt(null)
      return outcome === 'accepted'
    },
    applyUpdate: async () => {
      if (updateServiceWorker) await updateServiceWorker(true)
    },
    dismissUpdate: () => setUpdateAvailable(false),
  }), [installPlatform, installPrompt, isInstalled, isOnline, isStandalone, serviceWorkerStatus, updateAvailable, updateServiceWorker])

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>
}

export const usePWA = (): PWAState => {
  const context = useContext(PWAContext)
  if (!context) throw new Error('usePWA must be used inside PWAProvider')
  return context
}
