import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { PWAProvider } from './contexts/PWAContext'
import { AppearanceProvider } from './contexts/AppearanceContext'
import { initializeAppearance } from './utils/appearance'

initializeAppearance()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppearanceProvider><PWAProvider><App /></PWAProvider></AppearanceProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
