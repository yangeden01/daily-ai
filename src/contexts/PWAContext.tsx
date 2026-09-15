import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { getInstallPlatform, isIframeEnvironment, isStandaloneDisplay, shouldShowInstallExperience, type InstallPlatform } from '../utils/pwa'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type ServiceWorkerStatus = 'unsupported' | 'registering' | 'ready' | 'error'
export type UpdateCheckResult = 'available' | 'current' | 'offline' | 'unsupported' | 'error'

interface PWAState {
  isOnline: boolean
  isInstalled: boolean
  isStandalone: boolean
  isInIframe: boolean
  installPlatform: InstallPlatform
  canPromptInstall: boolean
  showInstallExperience: boolean
  serviceWorkerStatus: ServiceWorkerStatus
  updateAvailable: boolean
  isUpdating: boolean
  install(): Promise<boolean>
  openInNewTab(): void
  applyUpdate(): Promise<void>
  checkForUpdate(): Promise<UpdateCheckResult>
  forceReload(): Promise<void>
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
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateServiceWorker, setUpdateServiceWorker] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const updateAvailableRef = useRef(false)
  const isUpdatingRef = useRef(false)
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

    const boundRegistrations = new WeakSet<ServiceWorkerRegistration>()

    const checkRegistration = (registration: ServiceWorkerRegistration) => {
      registrationRef.current = registration
      setServiceWorkerStatus('ready')

      if (registration.waiting) {
        updateAvailableRef.current = true
        setUpdateAvailable(true)
      }

      if (!boundRegistrations.has(registration)) {
        boundRegistrations.add(registration)
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (installing) {
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                updateAvailableRef.current = true
                setUpdateAvailable(true)
              }
            })
          }
        })
      }
    }

    let intervalId: number | undefined
    let onVisibilityChange: (() => void) | undefined
    let onFocus: (() => void) | undefined

    const update = registerSW({
      immediate: true,
      onNeedReload: () => {
        // 防止 Workbox 自動 reload 造成 iOS Safari 陷入重複跳動的 reload 循環
      },
      onRegistered: (registration) => {
        if (registration) {
          checkRegistration(registration)
          if (!registration.waiting && !registration.installing) {
            registration.update().catch(() => {})
          }

          // 每 60 分鐘背景定期檢查一次，避免頻繁輪詢造成 iOS Safari 衝突與跳動
          intervalId = window.setInterval(() => {
            if (!isUpdatingRef.current && !updateAvailableRef.current) {
              registration.update().catch(() => {})
            }
          }, 60 * 60 * 1000)

          let lastCheckTime = Date.now()
          onVisibilityChange = () => {
            if (
              document.visibilityState === 'visible' &&
              Date.now() - lastCheckTime > 30 * 60 * 1000 &&
              !isUpdatingRef.current &&
              !updateAvailableRef.current
            ) {
              lastCheckTime = Date.now()
              registration.update().catch(() => {})
            }
          }
          onFocus = () => {
            if (
              Date.now() - lastCheckTime > 30 * 60 * 1000 &&
              !isUpdatingRef.current &&
              !updateAvailableRef.current
            ) {
              lastCheckTime = Date.now()
              registration.update().catch(() => {})
            }
          }
          document.addEventListener('visibilitychange', onVisibilityChange)
          window.addEventListener('focus', onFocus)
        }
      },
      onRegisterError: () => setServiceWorkerStatus('error'),
      onNeedRefresh: () => {
        updateAvailableRef.current = true
        setUpdateAvailable(true)
      },
    })
    setUpdateServiceWorker(() => update)

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        checkRegistration(reg)
      }
    }).catch(() => {})

    return () => {
      if (intervalId) window.clearInterval(intervalId)
      if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange)
      if (onFocus) window.removeEventListener('focus', onFocus)
    }
  }, [])

  const isInIframe = isIframeEnvironment()

  const value = useMemo<PWAState>(() => ({
    isOnline,
    isInstalled: isInstalled || isStandalone,
    isStandalone,
    isInIframe,
    installPlatform,
    canPromptInstall: Boolean(installPrompt),
    showInstallExperience: shouldShowInstallExperience(isInstalled, isStandalone),
    serviceWorkerStatus,
    updateAvailable,
    isUpdating,
    install: async () => {
      if (!installPrompt) return false
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') setInstallPrompt(null)
      return outcome === 'accepted'
    },
    openInNewTab: () => {
      window.open(window.location.href, '_blank', 'noopener,noreferrer')
    },
    applyUpdate: async () => {
      if (!('serviceWorker' in navigator) || isUpdatingRef.current) return
      isUpdatingRef.current = true
      setIsUpdating(true)

      try {
        const registration = registrationRef.current ?? await navigator.serviceWorker.getRegistration()
        let controllerChanged = false

        const waitForController = new Promise<void>((resolve) => {
          const timeoutId = window.setTimeout(() => {
            resolve()
          }, 2500)
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!controllerChanged) {
              controllerChanged = true
              window.clearTimeout(timeoutId)
              resolve()
            }
          }, { once: true })
        })

        if (updateServiceWorker) {
          await updateServiceWorker(false)
        } else if (registration?.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }

        await waitForController

        // 清除舊快取避免 iOS Safari 讀取舊資源
        if ('caches' in window) {
          try {
            const cacheKeys = await window.caches.keys()
            await Promise.all(cacheKeys.filter(k => !k.includes('workbox-precache')).map((key) => window.caches.delete(key)))
          } catch {
            // ignore
          }
        }

        // 破除 iOS WebKit / Safari PWA 硬快取，使用帶有時間戳參數的 replace 導航，避免白屏或舊版本覆蓋跳動
        const url = new URL(window.location.href)
        url.searchParams.set('_v', Date.now().toString())
        window.location.replace(url.toString())
      } catch {
        isUpdatingRef.current = false
        setIsUpdating(false)
      }
    },
    checkForUpdate: async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported'
      if (!navigator.onLine) return 'offline'
      try {
        const registration = registrationRef.current ?? await navigator.serviceWorker.getRegistration()
        if (!registration) return 'unsupported'
        updateAvailableRef.current = false
        await registration.update()
        await new Promise((resolve) => setTimeout(resolve, 250))
        return updateAvailableRef.current || Boolean(registration.waiting) ? 'available' : 'current'
      } catch {
        return 'error'
      }
    },
    forceReload: async () => {
      try {
        if ('caches' in window) {
          const cacheKeys = await window.caches.keys()
          await Promise.all(cacheKeys.map((key) => window.caches.delete(key)))
        }
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations()
          await Promise.all(registrations.map((r) => r.unregister()))
        }
      } catch {
        // ignore
      }
      // 強制帶時間戳參數重整，破除瀏覽器 HTTP 硬快取
      const url = new URL(window.location.href)
      url.searchParams.set('_t', Date.now().toString())
      window.location.replace(url.toString())
    },
    dismissUpdate: () => {
      updateAvailableRef.current = false
      setUpdateAvailable(false)
    },
  }), [isInIframe, installPlatform, installPrompt, isInstalled, isOnline, isStandalone, serviceWorkerStatus, updateAvailable, isUpdating, updateServiceWorker])

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>
}

export const usePWA = (): PWAState => {
  const context = useContext(PWAContext)
  if (!context) throw new Error('usePWA must be used inside PWAProvider')
  return context
}
