import { Outlet } from 'react-router-dom'
import Header from '../Header/Header'
import BottomNavigation from '../BottomNavigation/BottomNavigation'
import { RefreshCw, X } from 'lucide-react'
import { usePWA } from '../../contexts/PWAContext'

export default function MainLayout() {
  const { updateAvailable, applyUpdate, dismissUpdate } = usePWA()
  return (
    <div className="min-h-[100dvh]">
      <Header />
      <div className="app-content mx-auto w-full max-w-2xl px-5 sm:px-8">
        <Outlet />
      </div>
      <BottomNavigation />
      {updateAvailable && (
        <div className="update-banner" role="status">
          <div><strong>有新版本</strong><span>更新後即可使用最新功能。</span></div>
          <button type="button" className="update-button" onClick={() => void applyUpdate()}><RefreshCw size={15} />更新</button>
          <button type="button" className="update-dismiss" onClick={dismissUpdate} aria-label="稍後更新"><X size={16} /></button>
        </div>
      )}
    </div>
  )
}
