const SEARCH_HISTORY_KEY = 'daily-ai.search-history'
const SEARCH_HISTORY_LIMIT = 5

export const addSearchHistory = (history: string[], query: string): string[] => {
  const normalized = query.trim()
  if (!normalized) return history
  return [normalized, ...history.filter((item) => item !== normalized)].slice(0, SEARCH_HISTORY_LIMIT)
}

export const loadSearchHistory = (): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      .slice(0, SEARCH_HISTORY_LIMIT)
  } catch {
    return []
  }
}

export const saveSearchHistory = (history: string[]): void => {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, SEARCH_HISTORY_LIMIT)))
  } catch {
    // Search still works when storage is unavailable (for example, private browsing restrictions).
  }
}
