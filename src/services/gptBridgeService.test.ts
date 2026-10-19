import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Event } from '../models/Event'
import {
  DEFAULT_GPT_BRIDGE_URL,
  DEFAULT_GPT_SECRET_KEY,
  getGptBridgeUrl,
  getLastGptSyncInfo,
  getGptSecretKey,
  isGptAutoSyncEnabled,
  isGptSyncing,
  setGptAutoSyncEnabled,
  setGptBridgeUrl,
  setGptSecretKey,
  syncGptCloudSnapshot,
} from './gptBridgeService'

const mockEvents: Event[] = [
  {
    id: 'evt-1',
    date: '2026-10-18',
    title: '開會',
    detail: '討論專案進度',
    category: '工作',
    recordType: 'daily',
    tags: ['重要'],
    updatedAt: '2026-10-18T10:00:00Z',
  },
]

describe('gptBridgeService', () => {
  let values: Map<string, string>

  beforeEach(() => {
    values = new Map<string, string>()
    const storage: Storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => { values.delete(key) },
      clear: () => { values.clear() },
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size },
    }

    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('window', {
      localStorage: storage,
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('provides default URL and Secret Key when none is saved', () => {
    expect(getGptBridgeUrl()).toBe(DEFAULT_GPT_BRIDGE_URL)
    expect(getGptSecretKey()).toBe(DEFAULT_GPT_SECRET_KEY)
  })

  it('saves and clears custom URL and Secret Key', () => {
    setGptBridgeUrl('https://example.com/exec')
    expect(getGptBridgeUrl()).toBe('https://example.com/exec')

    setGptBridgeUrl('')
    expect(getGptBridgeUrl()).toBe(DEFAULT_GPT_BRIDGE_URL)

    setGptSecretKey('custom_secret_123')
    expect(getGptSecretKey()).toBe('custom_secret_123')

    setGptSecretKey('')
    expect(getGptSecretKey()).toBe(DEFAULT_GPT_SECRET_KEY)
  })

  it('defaults auto-sync to enabled and allows toggling', () => {
    expect(isGptAutoSyncEnabled()).toBe(true)

    setGptAutoSyncEnabled(false)
    expect(isGptAutoSyncEnabled()).toBe(false)

    setGptAutoSyncEnabled(true)
    expect(isGptAutoSyncEnabled()).toBe(true)
  })

  it('performs forced immediate sync and updates last sync info', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })
    vi.stubGlobal('fetch', fetchMock)

    const promise = syncGptCloudSnapshot(mockEvents, { force: true })
    const result = await promise

    expect(result.success).toBe(true)
    expect(result.count).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const syncInfo = getLastGptSyncInfo()
    expect(syncInfo.status).toBe('success')
    expect(syncInfo.count).toBe(1)
    expect(syncInfo.time).toBeTruthy()
    expect(isGptSyncing()).toBe(false)
  })

  it('debounces auto-sync calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })
    vi.stubGlobal('fetch', fetchMock)

    void syncGptCloudSnapshot(mockEvents)
    void syncGptCloudSnapshot(mockEvents)

    expect(fetchMock).not.toHaveBeenCalled()

    // Advance timers past debounce period (2500ms)
    await vi.advanceTimersByTimeAsync(3000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('skips auto-sync if auto-sync is disabled', async () => {
    setGptAutoSyncEnabled(false)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await syncGptCloudSnapshot(mockEvents)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Auto sync disabled')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('handles network failure gracefully without crashing', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await syncGptCloudSnapshot(mockEvents, { force: true })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')

    const syncInfo = getLastGptSyncInfo()
    expect(syncInfo.status).toContain('error')
  })
})
