import { useLocation, useNavigate } from 'react-router-dom'
import { appModeFromSearch, routeForMode, type AppMode } from '../../utils/appMode'

export default function ModeSwitch() {
  const location = useLocation()
  const navigate = useNavigate()
  const mode = appModeFromSearch(location.search)

  const selectMode = (nextMode: AppMode) => {
    if (nextMode === mode) return
    const basePath = location.pathname.startsWith('/daily/') ? '/daily' : location.pathname
    const nextSearch = new URLSearchParams(location.search)
    if (basePath === '/ai') nextSearch.delete('q')
    navigate(routeForMode(basePath, nextMode, `?${nextSearch.toString()}`))
  }

  return (
    <div className="mode-switch" data-mode={mode} role="group" aria-label="資料模式">
      <button type="button" aria-pressed={mode === 'daily'} className={mode === 'daily' ? 'mode-switch-active' : ''} onClick={() => selectMode('daily')}>Daily</button>
      <button type="button" aria-pressed={mode === 'notes'} className={mode === 'notes' ? 'mode-switch-active' : ''} onClick={() => selectMode('notes')}>Notes</button>
    </div>
  )
}
