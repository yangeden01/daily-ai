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
