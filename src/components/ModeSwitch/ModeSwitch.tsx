import { useLocation, useNavigate } from 'react-router-dom'
import { CalendarHeart, Clock, NotebookPen } from 'lucide-react'
import { appModeFromSearch, routeForMode, type AppMode } from '../../utils/appMode'

export default function ModeSwitch() {
  const location = useLocation()
  const navigate = useNavigate()
  const mode = appModeFromSearch(location.search)

  const selectMode = (nextMode: AppMode) => {
    if (nextMode === mode) return
    const basePath = location.pathname.startsWith('/daily/') ? '/daily' : location.pathname
    if (basePath === '/ai') {
      navigate(routeForMode('/ai', nextMode))
      return
    }
    const nextSearch = new URLSearchParams(location.search)
    navigate(routeForMode(basePath, nextMode, `?${nextSearch.toString()}`))
  }

  return (
    <div className="mode-switch" data-mode={mode} role="group" aria-label="資料模式">
      <button
        type="button"
        aria-pressed={mode === 'daily'}
        className={mode === 'daily' ? 'mode-switch-active' : ''}
        onClick={() => selectMode('daily')}
      >
        <Clock size={13} strokeWidth={2.2} className="shrink-0 sm:h-3.5 sm:w-3.5" />
        <span>Daily</span>
      </button>
      <button
        type="button"
        aria-pressed={mode === 'notes'}
        className={mode === 'notes' ? 'mode-switch-active' : ''}
        onClick={() => selectMode('notes')}
      >
        <NotebookPen size={13} strokeWidth={2.2} className="shrink-0 sm:h-3.5 sm:w-3.5" />
        <span>Notes</span>
      </button>
      <button
        type="button"
        aria-pressed={mode === 'anniversary'}
        className={mode === 'anniversary' ? 'mode-switch-active' : ''}
        onClick={() => selectMode('anniversary')}
      >
        <CalendarHeart size={13} strokeWidth={2.2} className="shrink-0 sm:h-3.5 sm:w-3.5" />
        <span>紀念日</span>
      </button>
    </div>
  )
}
