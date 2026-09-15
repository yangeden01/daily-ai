import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Download } from 'lucide-react'
import { usePWA } from '../../contexts/PWAContext'
import ModeSwitch from '../ModeSwitch/ModeSwitch'
import { appModeFromSearch } from '../../utils/appMode'
import InstallGuideModal from '../InstallModal/InstallGuideModal'

const pageTitles: Record<string, string> = {
  '/daily': 'Daily Record',
  '/ai': 'Search',
  '/dashboard': 'Dashboard',
  '/settings': 'Settings',
}

export default function Header() {
  const { pathname, search } = useLocation()
  const { isStandalone, showInstallExperience, canPromptInstall, install } = usePWA()
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const mode = appModeFromSearch(search)
  const isNotes = mode === 'notes'
  const isAnniversary = mode === 'anniversary'
  const showModeSwitch = pathname !== '/settings'

  let title = pageTitles[pathname] ?? '手機記事本'
  if (pathname.startsWith('/daily/')) {
    title = isAnniversary ? '紀念日詳情' : isNotes ? 'Note Detail' : 'Event Detail'
  } else if (pathname === '/daily') {
    title = isAnniversary ? '紀念日' : isNotes ? 'Notes' : 'Daily Record'
  }

  const handleInstallClick = () => {
    if (canPromptInstall) {
      void install()
    } else {
      setShowInstallGuide(true)
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-2 px-3.5 sm:px-6">
          <h1 className="shrink-0 truncate text-base font-extrabold tracking-tight text-stone-950 sm:text-xl dark:text-white">{title}</h1>
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {showInstallExperience && !isStandalone && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 active:bg-indigo-800"
                title="安裝 手機記事本 App"
              >
                <Download size={12} strokeWidth={2.5} />
                <span className="hidden xs:inline sm:inline">安裝</span>
              </button>
            )}
            {showModeSwitch && <ModeSwitch />}
          </div>
        </div>
      </header>
      <InstallGuideModal isOpen={showInstallGuide} onClose={() => setShowInstallGuide(false)} />
    </>
  )
}
