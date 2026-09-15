const SEARCH_HISTORY_KEY = 'daily-ai.search-history'
const SEARCH_HISTORY_LIMIT = 5
const LAST_SEARCH_FILTER_KEY = 'daily-ai.last-search-filter'
type SearchHistoryMode = 'daily' | 'notes' | 'anniversary' | string

export interface SavedSearchFilter {
  category: string
  tag: string
  query?: string
}

const storageKeyForMode = (mode: SearchHistoryMode): string =>
  mode === 'notes' ? `${SEARCH_HISTORY_KEY}.notes` : mode === 'anniversary' ? `${SEARCH_HISTORY_KEY}.anniversary` : SEARCH_HISTORY_KEY

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

export const loadLastSearchFilter = (mode: SearchHistoryMode = 'daily'): SavedSearchFilter => {
  try {
    const raw = localStorage.getItem(`${LAST_SEARCH_FILTER_KEY}.${mode}`)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedSearchFilter>
      return {
        category: typeof parsed.category === 'string' ? parsed.category : '',
        tag: typeof parsed.tag === 'string' ? parsed.tag : '',
        query: typeof parsed.query === 'string' ? parsed.query : '',
      }
    }
  } catch {
    // fallback
  }
  return { category: '', tag: '', query: '' }
}

export const saveLastSearchFilter = (mode: SearchHistoryMode = 'daily', filter: SavedSearchFilter): void => {
  try {
    localStorage.setItem(`${LAST_SEARCH_FILTER_KEY}.${mode}`, JSON.stringify(filter))
  } catch {
    // ignore
  }
}
