import { NavLink, useLocation } from 'react-router-dom'
import { ChartNoAxesColumnIncreasing, NotebookPen, Search, Settings } from 'lucide-react'

const navigationItems = [
  { to: '/daily', icon: NotebookPen, label: 'Daily' },
  { to: '/ai', icon: Search, label: 'Search' },
  { to: '/dashboard', icon: ChartNoAxesColumnIncreasing, label: 'Dashboard' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function BottomNavigation() {
  const location = useLocation()
  const routeState = location.state as { returnTo?: string } | null
  const detailReturnTo = location.pathname.startsWith('/daily/') ? routeState?.returnTo : undefined
  const activePath = detailReturnTo?.startsWith('/ai?')
    ? '/ai'
    : detailReturnTo?.startsWith('/dashboard?') ? '/dashboard' : location.pathname

  return (
    <nav className="bottom-nav" aria-label="主要導覽">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {navigationItems.map(({ to, icon: Icon, label }) => {
          const isActive = activePath === to || activePath.startsWith(`${to}/`)
          return (
          <NavLink
            key={to}
            to={to}
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
