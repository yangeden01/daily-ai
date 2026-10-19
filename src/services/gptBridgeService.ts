import type { Event } from '../models/Event'

export const GPT_BRIDGE_URL_KEY = 'edennote_gpt_bridge_url'
export const GPT_SECRET_KEY_KEY = 'edennote_gpt_secret_key'
export const GPT_AUTO_SYNC_ENABLED_KEY = 'edennote_gpt_auto_sync_enabled'
export const GPT_LAST_SYNC_TIME_KEY = 'edennote_gpt_last_sync_time'
export const GPT_LAST_SYNC_STATUS_KEY = 'edennote_gpt_last_sync_status'

export const DEFAULT_GPT_BRIDGE_URL =
  'https://script.google.com/macros/s/AKfycbw9VzMUGW9ASUgms7_xb6r_iPfX-cD7uHbHoFavkmIbJSntOCpNM-kHajKyimXwXngf/exec'
export const DEFAULT_GPT_SECRET_KEY = 'eden_secret_888'

export const getGptBridgeUrl = (): string => {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_GPT_BRIDGE_URL
  return localStorage.getItem(GPT_BRIDGE_URL_KEY) || DEFAULT_GPT_BRIDGE_URL
}

export const setGptBridgeUrl = (url: string): void => {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (url.trim()) {
    localStorage.setItem(GPT_BRIDGE_URL_KEY, url.trim())
  } else {
    localStorage.removeItem(GPT_BRIDGE_URL_KEY)
  }
}

export const getGptSecretKey = (): string => {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_GPT_SECRET_KEY
  return localStorage.getItem(GPT_SECRET_KEY_KEY) || DEFAULT_GPT_SECRET_KEY
}

export const setGptSecretKey = (key: string): void => {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (key.trim()) {
    localStorage.setItem(GPT_SECRET_KEY_KEY, key.trim())
  } else {
    localStorage.removeItem(GPT_SECRET_KEY_KEY)
  }
}

export const isGptAutoSyncEnabled = (): boolean => {
  if (typeof window === 'undefined' || !window.localStorage) return true
  const stored = localStorage.getItem(GPT_AUTO_SYNC_ENABLED_KEY)
  if (stored === null) return true // Default to enabled
  return stored === 'true'
}

export const setGptAutoSyncEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined' || !window.localStorage) return
  localStorage.setItem(GPT_AUTO_SYNC_ENABLED_KEY, String(enabled))
}

export const getLastGptSyncInfo = (): { time: string | null; status: string | null; count: number | null } => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { time: null, status: null, count: null }
  }
  const time = localStorage.getItem(GPT_LAST_SYNC_TIME_KEY)
  const status = localStorage.getItem(GPT_LAST_SYNC_STATUS_KEY)
  let count: number | null = null
  try {
    const rawCount = localStorage.getItem('edennote_gpt_last_sync_count')
    if (rawCount) count = Number(rawCount)
  } catch {
    // ignore
  }
  return { time, status, count }
}

let isCurrentlySyncing = false
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null
let hasPendingRetry = false
let lastCachedEvents: Event[] | null = null

export const isGptSyncing = (): boolean => isCurrentlySyncing

/**
 * Perform sync to Google Apps Script Web App.
 * Simplifies and packages events into clean JSON, ensuring zero blockage on UI thread.
 */
const executeSync = async (
  events: Event[]
): Promise<{ success: boolean; count: number; error?: string }> => {
  const url = getGptBridgeUrl().trim()
  const key = getGptSecretKey().trim()

  if (!url) {
    return { success: false, count: 0, error: '未設定 Google Apps Script 網址' }
  }

  const simplifiedEvents = events.map((evt) => ({
    id: evt.id,
    date: evt.date || '',
    title: evt.title || '',
    detail: evt.detail || '',
    category: evt.category || '',
    recordType: evt.recordType || 'daily',
    tags: evt.tags || [],
    calendarType: evt.calendarType,
    lunarMonth: evt.lunarMonth,
    lunarDay: evt.lunarDay,
    updatedAt: evt.updatedAt || evt.lastEditedAt || '',
  }))

  const targetEndpoint = `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`

  isCurrentlySyncing = true
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('edennote:gpt-sync-started'))
  }

  try {
    const response = await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        events: simplifiedEvents,
        syncedAt: new Date().toISOString(),
      }),
    })

    if (!response.ok && response.type !== 'opaque') {
      throw new Error(`HTTP ${response.status}`)
    }

    hasPendingRetry = false

    if (typeof window !== 'undefined' && window.localStorage) {
      const nowStr = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      localStorage.setItem(GPT_LAST_SYNC_TIME_KEY, nowStr)
      localStorage.setItem(GPT_LAST_SYNC_STATUS_KEY, 'success')
      localStorage.setItem('edennote_gpt_last_sync_count', String(simplifiedEvents.length))
      window.dispatchEvent(new CustomEvent('edennote:gpt-sync-completed', { detail: { success: true, count: simplifiedEvents.length } }))
    }

    return { success: true, count: simplifiedEvents.length }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    hasPendingRetry = true

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(GPT_LAST_SYNC_STATUS_KEY, `error: ${errorMsg}`)
      window.dispatchEvent(new CustomEvent('edennote:gpt-sync-completed', { detail: { success: false, error: errorMsg } }))
    }
    return { success: false, count: 0, error: errorMsg }
  } finally {
    isCurrentlySyncing = false
  }
}

// Setup automatic retry on network recovery if pending
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('online', () => {
    if (hasPendingRetry && lastCachedEvents && isGptAutoSyncEnabled()) {
      void syncGptCloudSnapshot(lastCachedEvents)
    }
  })
}

/**
 * Synchronize current events to ChatGPT Google Drive endpoint.
 * When called automatically, uses a 2.5-second debounce to avoid excessive requests during rapid editing.
 * When `force: true` (e.g. manual button click), executes immediately.
 */
export const syncGptCloudSnapshot = (
  events: Event[],
  options: { force?: boolean } = {}
): Promise<{ success: boolean; count: number; error?: string }> => {
  lastCachedEvents = events

  if (options.force) {
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer)
      syncDebounceTimer = null
    }
    return executeSync(events)
  }

  // Automatic background sync: check if enabled
  if (!isGptAutoSyncEnabled()) {
    return Promise.resolve({ success: false, count: 0, error: 'Auto sync disabled' })
  }

  return new Promise((resolve) => {
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer)
    }

    syncDebounceTimer = setTimeout(() => {
      syncDebounceTimer = null
      void executeSync(events).then(resolve)
    }, 2500)
  })
}
