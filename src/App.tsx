import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
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

    // 4. Android 原生系統返回鍵（置底回車鍵 <）監聽與導航分派
    let backButtonHandle: { remove: () => void } | null = null
    if (Capacitor.isNativePlatform()) {
      void CapApp.addListener('backButton', ({ canGoBack }) => {
        // (A) 若有相片預覽燈箱、選單或浮層開啟，優先關閉浮層
        const openModal = document.querySelector('[data-modal-open="true"]')
        if (openModal) {
          window.dispatchEvent(new CustomEvent('swiftnote:dismiss-modal'))
          return
        }

        // (B) 若處於記事/事件詳細編輯頁 (/daily/:eventId)，通知頁面返回前頁清單（同 Timeline 按鈕）
        const pathname = window.location.pathname
        if (pathname.startsWith('/daily/') && pathname !== '/daily') {
          window.dispatchEvent(new CustomEvent('swiftnote:back-to-list'))
          return
        }

        // (C) 若處於 AI、儀表板或設定頁，按返回鍵切回主頁 daily 清單
        if (pathname === '/ai' || pathname === '/dashboard' || pathname === '/settings') {
          navigate('/daily')
          return
        }

        // (D) 若在首頁 daily 清單且無上層路徑，優雅退出應用程式
        if (pathname === '/daily' || pathname === '/') {
          void CapApp.exitApp()
        } else if (canGoBack) {
          window.history.back()
        }
      }).then((handle) => {
        backButtonHandle = handle
      })
    }

    return () => {
      window.removeEventListener('swiftnote:navigate', handleWidgetNavigate as EventListener)
      if (backButtonHandle) {
        backButtonHandle.remove()
      }
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
