import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from '../Header/Header'
import BottomNavigation from '../BottomNavigation/BottomNavigation'
import { LoaderCircle, RefreshCw, X } from 'lucide-react'
import { usePWA } from '../../contexts/PWAContext'
import { appModeFromSearch } from '../../utils/appMode'

export default function MainLayout() {
  const { updateAvailable, isUpdating, applyUpdate, dismissUpdate } = usePWA()
  const location = useLocation()
  const mode = appModeFromSearch(location.search)

  useEffect(() => {
    document.documentElement.setAttribute('data-app-mode', mode)
  }, [mode])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      const active = document.activeElement
      if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) {
        return
      }
      // If the tap is inside an interactive element, do not force blur
      if (target.closest('input, textarea, button, a, label, select, [role="button"], .text-indent-toolbar, .clear-field-button, .date-wheel-column, .attachment-picker, .event-detail-editable, .anniversary-sort-switch, .note-sort-switch')) {
        return
      }
      active.blur()
    }

    window.addEventListener('pointerdown', handlePointerDown, { passive: true })

    // Listen for mobile viewport resize (e.g. system keyboard dismiss button ⌄ or back gesture)
    const viewport = window.visualViewport
    let lastHeight = viewport ? viewport.height : window.innerHeight

    const handleViewportResize = () => {
      const currentHeight = viewport ? viewport.height : window.innerHeight
      // If viewport expanded by more than 80px (keyboard closed by system hide button ⌄ or back gesture)
      if (currentHeight - lastHeight > 80) {
        const active = document.activeElement
        if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
          active.blur()
        }
      }
      lastHeight = currentHeight
    }

    if (viewport) {
      viewport.addEventListener('resize', handleViewportResize)
    } else {
      window.addEventListener('resize', handleViewportResize)
    }

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      if (viewport) {
        viewport.removeEventListener('resize', handleViewportResize)
      } else {
        window.removeEventListener('resize', handleViewportResize)
      }
    }
  }, [])

  return (
    <div className="min-h-[100dvh]" data-mode={mode}>
      <Header />
      <div className="app-content mx-auto w-full max-w-2xl px-5 sm:px-8">
        <Outlet />
      </div>
      <BottomNavigation />
      {updateAvailable && (
        <div className="update-banner" role="status">
          <div>
            <strong>{isUpdating ? '正在更新' : '有新版本'}</strong>
            <span>{isUpdating ? '正在載入最新功能，請稍候...' : '更新後即可使用最新功能。'}</span>
          </div>
          <button
            type="button"
            className="update-button"
            disabled={isUpdating}
            onClick={() => void applyUpdate()}
          >
            {isUpdating ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            <span>{isUpdating ? '更新中' : '更新'}</span>
          </button>
          {!isUpdating && (
            <button type="button" className="update-dismiss" onClick={dismissUpdate} aria-label="稍後更新"><X size={16} /></button>
          )}
        </div>
      )}
    </div>
  )
}
