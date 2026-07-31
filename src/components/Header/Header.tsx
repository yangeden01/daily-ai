import { useLocation } from 'react-router-dom'
import { Wifi, WifiOff } from 'lucide-react'
import { usePWA } from '../../contexts/PWAContext'
import ModeSwitch from '../ModeSwitch/ModeSwitch'
import { appModeFromSearch } from '../../utils/appMode'

const pageTitles: Record<string, string> = {
  '/daily': 'Daily Record',
  '/ai': 'Search',
  '/dashboard': 'Dashboard',
  '/settings': 'Settings',
}

export default function Header() {
  const { pathname, search } = useLocation()
  const { isOnline } = usePWA()
  const isNotes = appModeFromSearch(search) === 'notes'
  const showModeSwitch = pathname !== '/settings'
  const title = pathname.startsWith('/daily/') ? (isNotes ? 'Note Detail' : 'Event Detail') : pathname === '/daily' && isNotes ? 'Notes' : pageTitles[pathname] ?? 'Daily AI'

  return (
    <header className="app-header">
      <div className={`mx-auto grid h-16 max-w-2xl items-center gap-2 px-4 sm:px-8 ${showModeSwitch ? 'grid-cols-[minmax(0,1fr)_auto_auto]' : 'grid-cols-[minmax(0,1fr)_auto]'}`}>
        <h1 className="truncate text-lg font-bold tracking-[-0.025em] text-stone-950 sm:text-xl dark:text-white">{title}</h1>
        {showModeSwitch && <ModeSwitch />}
        <span className={`network-pill justify-self-end ${isOnline ? 'network-online' : 'network-offline'}`}>
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}{isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
    </header>
  )
}
