import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import MainLayout from './components/Layout/MainLayout'
import DailyPage from './pages/Daily/DailyPage'
import EventDetailPage from './pages/Daily/EventDetailPage'
import AIPage from './pages/AI/AIPage'
import SettingsPage from './pages/Settings/SettingsPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import { eventRepository } from './repositories'
import { syncWidgetSnapshot } from './services/widgetBridge'

export default function App() {
  const navigate = useNavigate()

  useEffect(() => {
    // 1. Synchronize snapshot on app startup
    void eventRepository.getAll().then((events) => {
      void syncWidgetSnapshot(events)
    })

    // 2. Listen for widget deep link navigation events
    const handleWidgetNavigate = (e: globalThis.Event) => {
      const customEvent = e as CustomEvent<{ route: string }>
      if (customEvent?.detail?.route) {
        navigate(customEvent.detail.route)
      }
    }
    window.addEventListener('swiftnote:navigate', handleWidgetNavigate as EventListener)

    // 3. Handle pending route if opened directly from widget
    const pendingRoute = (window as unknown as { __SWIFTNOTE_PENDING_ROUTE__?: string }).__SWIFTNOTE_PENDING_ROUTE__
    if (pendingRoute) {
      delete (window as unknown as { __SWIFTNOTE_PENDING_ROUTE__?: string }).__SWIFTNOTE_PENDING_ROUTE__
      navigate(pendingRoute)
    }

    return () => {
      window.removeEventListener('swiftnote:navigate', handleWidgetNavigate as EventListener)
    }
  }, [navigate])

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/daily" element={<DailyPage />} />
        <Route path="/daily/:eventId" element={<EventDetailPage />} />
        <Route path="/ai" element={<AIPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/daily" replace />} />
    </Routes>
  )
}
