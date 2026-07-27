import { NavLink } from 'react-router-dom'
import { Bot, ChartNoAxesColumnIncreasing, NotebookPen, Settings } from 'lucide-react'

const navigationItems = [
  { to: '/daily', icon: NotebookPen, label: 'Daily' },
  { to: '/ai', icon: Bot, label: 'AI' },
  { to: '/dashboard', icon: ChartNoAxesColumnIncreasing, label: 'Dashboard' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function BottomNavigation() {
  return (
    <nav className="bottom-nav" aria-label="主要導覽">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {navigationItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `tab ${isActive ? 'tab-active' : ''}`}
          >
            <Icon aria-hidden="true" size={20} strokeWidth={2.1} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
