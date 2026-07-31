import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChartNoAxesColumnIncreasing, NotebookPen, Search, Settings } from 'lucide-react'
import { clearTabDestination, getTabDestination, rememberTabDestination, tabBaseForReturnTo } from '../../utils/tabNavigationMemory'
import { appModeFromSearch, routeForMode } from '../../utils/appMode'

const navigationItems = [
  { to: '/daily', icon: NotebookPen, label: 'Daily' },
  { to: '/ai', icon: Search, label: 'Search' },
  { to: '/dashboard', icon: ChartNoAxesColumnIncreasing, label: 'Dashboard' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function BottomNavigation() {
  const location = useLocation()
  const mode = appModeFromSearch(location.search)
  const routeState = location.state as { returnTo?: string } | null
  const detailReturnTo = location.pathname.startsWith('/daily/') ? routeState?.returnTo : undefined
  const detailSourceTab = location.pathname.startsWith('/daily/') ? tabBaseForReturnTo(detailReturnTo) : null
  const activePath = detailReturnTo?.startsWith('/ai?')
    ? '/ai'
    : detailReturnTo?.startsWith('/dashboard?') ? '/dashboard' : location.pathname

  useEffect(() => {
    if (location.pathname === '/daily' || location.pathname === '/ai' || location.pathname === '/dashboard') {
      clearTabDestination(location.pathname)
    }
  }, [location.pathname])

  const rememberCurrentDetail = () => {
    if (!detailSourceTab) return
    rememberTabDestination(detailSourceTab, {
      pathname: location.pathname,
      search: location.search,
      state: routeState,
    })
  }

  return (
    <nav className="bottom-nav" aria-label="主要導覽">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {navigationItems.map(({ to, icon: Icon, label }) => {
          const isActive = activePath === to || activePath.startsWith(`${to}/`)
          const remembered = getTabDestination(to)
          const destination = remembered ? { pathname: remembered.pathname, search: remembered.search } : routeForMode(to, mode)
          return (
          <NavLink
            key={to}
            to={destination}
            state={remembered?.state}
            onClick={rememberCurrentDetail}
            className={`tab ${isActive ? 'tab-active' : ''}`}
          >
            <Icon aria-hidden="true" size={20} strokeWidth={2.1} />
            <span>{label}</span>
          </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
