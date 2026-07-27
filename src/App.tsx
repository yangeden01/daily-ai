import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './components/Layout/MainLayout'
import DailyPage from './pages/Daily/DailyPage'
import EventDetailPage from './pages/Daily/EventDetailPage'
import AIPage from './pages/AI/AIPage'
import SettingsPage from './pages/Settings/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/daily" element={<DailyPage />} />
        <Route path="/daily/:eventId" element={<EventDetailPage />} />
        <Route path="/ai" element={<AIPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/daily" replace />} />
    </Routes>
  )
}
