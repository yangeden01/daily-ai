export type BackgroundTheme = 'system' | 'light' | 'dark' | 'paper'
export type TextTheme = 'sans' | 'serif'

export interface AppearancePreferences {
  background: BackgroundTheme
  text: TextTheme
}

export const DEFAULT_APPEARANCE: AppearancePreferences = { background: 'system', text: 'sans' }
const STORAGE_KEY = 'daily-ai.appearance'
const backgrounds: BackgroundTheme[] = ['system', 'light', 'dark', 'paper']
const texts: TextTheme[] = ['sans', 'serif']

export const normalizeAppearance = (value: unknown): AppearancePreferences => {
  if (!value || typeof value !== 'object') return DEFAULT_APPEARANCE
  const candidate = value as Partial<AppearancePreferences>
  return {
    background: backgrounds.includes(candidate.background as BackgroundTheme) ? candidate.background as BackgroundTheme : 'system',
    text: texts.includes(candidate.text as TextTheme) ? candidate.text as TextTheme : 'sans',
  }
}

export const loadAppearance = (): AppearancePreferences => {
  try {
    return normalizeAppearance(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export const saveAppearance = (value: AppearancePreferences): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Appearance still works for this session when persistent storage is unavailable.
  }
}

export const applyAppearance = (value: AppearancePreferences): void => {
  const followsDarkSystem = value.background === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = value.background === 'dark' || followsDarkSystem
  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  root.dataset.background = value.background === 'paper' ? 'paper' : 'plain'
  root.dataset.text = value.text
  root.style.colorScheme = isDark ? 'dark' : 'light'
}

export const initializeAppearance = (): AppearancePreferences => {
  const value = loadAppearance()
  applyAppearance(value)
  return value
}
