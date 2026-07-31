const SEARCH_HISTORY_KEY = 'daily-ai.search-history'
const SEARCH_HISTORY_LIMIT = 5
type SearchHistoryMode = 'daily' | 'notes'

const storageKeyForMode = (mode: SearchHistoryMode): string =>
  mode === 'notes' ? `${SEARCH_HISTORY_KEY}.notes` : SEARCH_HISTORY_KEY

export const addSearchHistory = (history: string[], query: string): string[] => {
  const normalized = query.trim()
  if (!normalized) return history
  return [normalized, ...history.filter((item) => item !== normalized)].slice(0, SEARCH_HISTORY_LIMIT)
}

export const loadSearchHistory = (mode: SearchHistoryMode = 'daily'): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem(storageKeyForMode(mode)) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      .slice(0, SEARCH_HISTORY_LIMIT)
  } catch {
    return []
  }
}

export const saveSearchHistory = (history: string[], mode: SearchHistoryMode = 'daily'): void => {
  try {
    localStorage.setItem(storageKeyForMode(mode), JSON.stringify(history.slice(0, SEARCH_HISTORY_LIMIT)))
  } catch {
    // Search still works when storage is unavailable (for example, private browsing restrictions).
  }
}
