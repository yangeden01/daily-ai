import { useLocation } from 'react-router-dom'
import { Wifi, WifiOff } from 'lucide-react'
import { usePWA } from '../../contexts/PWAContext'

const pageTitles: Record<string, string> = {
  '/daily': 'Daily Record',
  '/ai': 'Search',
  '/dashboard': 'Dashboard',
  '/settings': 'Settings',
}

export default function Header() {
  const { pathname } = useLocation()
  const { isOnline } = usePWA()
  const title = pathname.startsWith('/daily/') ? 'Event Detail' : pageTitles[pathname] ?? 'Daily AI'

  return (
    <header className="app-header">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-5 sm:px-8">
        <h1 className="text-xl font-bold tracking-[-0.025em] text-stone-950 dark:text-white">{title}</h1>
        <span className={`network-pill ${isOnline ? 'network-online' : 'network-offline'}`}>
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}{isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
    </header>
  )
}
