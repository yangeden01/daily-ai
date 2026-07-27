import { Outlet } from 'react-router-dom'
import Header from '../Header/Header'
import BottomNavigation from '../BottomNavigation/BottomNavigation'

export default function MainLayout() {
  return (
    <div className="min-h-dvh">
      <Header />
      <div className="mx-auto w-full max-w-2xl px-5 pb-28 pt-24 sm:px-8">
        <Outlet />
      </div>
      <BottomNavigation />
    </div>
  )
}
