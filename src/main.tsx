import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { PWAProvider } from './contexts/PWAContext'
import { AppearanceProvider } from './contexts/AppearanceContext'
import { AIProvider } from './contexts/AIContext'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary'
import { initializeAppearance } from './utils/appearance'
import { APP_VERSION } from './version'

initializeAppearance()

// 記錄當前程式版本
try {
  localStorage.setItem('__app_version', APP_VERSION)
} catch {
  // ignore
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppearanceProvider><PWAProvider><AIProvider><App /></AIProvider></PWAProvider></AppearanceProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
