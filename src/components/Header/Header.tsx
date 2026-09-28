import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Database, Download, Globe, KeyRound } from 'lucide-react'
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
  const { userApiKey, setShowKeyModal, enableSearch, setEnableSearch, isLocalMode } = useAI()
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

            {isAIMode ? (
              <div className="flex items-center gap-1 sm:gap-1.5">
                {/* Custom Gemini Key Button / Model Indicator */}
                <button
                  type="button"
                  onClick={() => setShowKeyModal(true)}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] sm:px-2.5 sm:text-xs font-semibold whitespace-nowrap transition ${
                    userApiKey
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                      : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                  }`}
                  title="設定或變更自訂 Gemini API Key"
                >
                  <KeyRound size={12} className={userApiKey ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'} />
                  <span>{userApiKey ? '✨ Gemini 3.8 Flash' : '🔑 設定 Key'}</span>
                </button>

                {/* Engine Mode or Google Search grounding toggle */}
                {isLocalMode ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-amber-50 px-2 py-1 text-[11px] sm:px-2.5 sm:text-xs font-semibold text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/60 dark:text-amber-300"
                    title="目前由 EdenNote 本機深度分析引擎提供離線私密運算"
                  >
                    <Database size={12} />
                    <span>本機引擎</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEnableSearch((prev) => !prev)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] sm:px-2.5 sm:text-xs font-semibold whitespace-nowrap transition ${
                      enableSearch
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                        : 'bg-stone-100 text-stone-400 border border-transparent dark:bg-stone-800 dark:text-stone-500'
                    }`}
                    title={enableSearch ? '已開啟 Google 聯網比對' : '已關閉 Google 聯網比對'}
                  >
                    <Globe size={12} />
                    <span>{enableSearch ? 'Google 聯網開' : '聯網關'}</span>
                  </button>
                )}
              </div>
            ) : (
              showModeSwitch && <ModeSwitch />
            )}
          </div>
        </div>
      </header>
      <InstallGuideModal isOpen={showInstallGuide} onClose={() => setShowInstallGuide(false)} />
    </>
  )
}
