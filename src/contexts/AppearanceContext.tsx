import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { applyAppearance, loadAppearance, saveAppearance, type AppearancePreferences, type BackgroundTheme, type TextTheme } from '../utils/appearance'

interface AppearanceContextValue extends AppearancePreferences {
  setBackground: (background: BackgroundTheme) => void
  setText: (text: TextTheme) => void
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState(loadAppearance)

  useEffect(() => {
    applyAppearance(appearance)
    saveAppearance(appearance)
    if (appearance.background !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const refresh = () => applyAppearance(appearance)
    media.addEventListener('change', refresh)
    return () => media.removeEventListener('change', refresh)
  }, [appearance])

  const value = useMemo<AppearanceContextValue>(() => ({
    ...appearance,
    setBackground: (background) => setAppearance((current) => ({ ...current, background })),
    setText: (text) => setAppearance((current) => ({ ...current, text })),
  }), [appearance])

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export const useAppearance = () => {
  const value = useContext(AppearanceContext)
  if (!value) throw new Error('useAppearance must be used inside AppearanceProvider')
  return value
}
