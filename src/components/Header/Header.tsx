import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/daily': 'Daily AI',
  '/ai': 'AI Search',
  '/settings': 'Settings',
}

export default function Header() {
  const { pathname } = useLocation()
  const title = pathname.startsWith('/daily/') ? 'Event Detail' : pageTitles[pathname] ?? 'Daily AI'

  return (
    <header className="app-header">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-5 sm:px-8">
        <h1 className="text-xl font-bold tracking-[-0.025em] text-stone-950 dark:text-white">{title}</h1>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">Alpha</span>
      </div>
    </header>
  )
}
