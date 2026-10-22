import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Download, KeyRound, RotateCcw } from 'lucide-react'
import { usePWA } from '../../contexts/PWAContext'
import { useAI } from '../../contexts/AIContext'
import ModeSwitch from '../ModeSwitch/ModeSwitch'
import { appModeFromSearch } from '../../utils/appMode'
import InstallGuideModal from '../InstallModal/InstallGuideModal'

const pageTitles: Record<string, string> = {
  '/daily': 'Daily Record',
  '/ai': 'Search',
  '/dashboard': 'EdenNote AI',
  '/settings': 'Settings',
}

export default function Header() {
  const { pathname, search } = useLocation()
  const { isStandalone, showInstallExperience, canPromptInstall, install } = usePWA()
  const { userApiKey, setShowKeyModal, activeTab, setActiveTab, triggerNewChat } = useAI()
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const mode = appModeFromSearch(search)
  const isNotes = mode === 'notes'
  const isAnniversary = mode === 'anniversary'
  const isAIMode = pathname === '/dashboard'
  const showModeSwitch = pathname !== '/settings' && !isAIMode

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
          {isAIMode ? (
            <div className="flex w-full items-center justify-between">
              {/* Left: Gemini API Key Setting / Status */}
              <button
                type="button"
                onClick={() => setShowKeyModal(true)}
                className={`flex h-10 items-center gap-1.5 rounded-full px-2.5 sm:px-3 transition active:scale-95 ${
                  userApiKey
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                    : 'bg-stone-200/70 text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700'
                }`}
                title="查詢或更換 Gemini API Key"
                aria-label="API Key 設定"
              >
                <KeyRound size={16} strokeWidth={2.2} className={userApiKey ? 'text-indigo-600 dark:text-indigo-400' : 'text-stone-600 dark:text-stone-400'} />
                <span className="text-xs font-bold hidden xs:inline">{userApiKey ? 'Gemini Key' : 'API Key'}</span>
              </button>

              {/* Center: Segmented Pill Switch [ 對話 | 工作 ] */}
              <div className="flex items-center rounded-full bg-stone-200/80 p-1 dark:bg-[#202124]">
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                    activeTab === 'chat'
                      ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-white'
                      : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
                  }`}
                >
                  對話
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('work')}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                    activeTab === 'work'
                      ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-white'
                      : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
                  }`}
                >
                  工作
                </button>
              </div>

              {/* Right: Circle New Chat Button */}
              <button
                type="button"
                onClick={triggerNewChat}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-200/60 text-stone-700 transition hover:bg-stone-200 active:scale-95 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                title="開啟新對話"
                aria-label="開啟新對話"
              >
                <RotateCcw size={18} strokeWidth={2.2} />
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </header>
      <InstallGuideModal isOpen={showInstallGuide} onClose={() => setShowInstallGuide(false)} />
    </>
  )
}
