import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Event } from '../models/Event'
import type { EventRepository } from '../repositories/EventRepository'
import {
  DEFAULT_GPT_BRIDGE_URL,
  DEFAULT_GPT_SECRET_KEY,
  clearLocalTombstones,
  getLocalTombstones,
  getGptBridgeUrl,
  getLastGptPullInfo,
  getLastGptSyncInfo,
  getGptSecretKey,
  isGptAutoSyncEnabled,
  isGptPulling,
  isGptSyncing,
  getLatestSyncDiagnostics,
  pullGptCloudEvents,
  recordLocalTombstone,
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
    attachmentIds: [],
    createdAt: '2026-10-18T10:00:00Z',
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
      removeItem: (key: string) => {
        values.delete(key)
      },
      clear: () => {
        values.clear()
      },
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size
      },
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

  it('provides default URL and Secret Key when unset', () => {
    expect(getGptBridgeUrl()).toBe(DEFAULT_GPT_BRIDGE_URL)
    expect(getGptSecretKey()).toBe(DEFAULT_GPT_SECRET_KEY)
  })

  it('allows updating and clearing custom URL and Secret Key', () => {
    setGptBridgeUrl('https://script.google.com/macros/s/custom/exec')
    setGptSecretKey('my_secret_key')

    expect(getGptBridgeUrl()).toBe('https://script.google.com/macros/s/custom/exec')
    expect(getGptSecretKey()).toBe('my_secret_key')

    setGptBridgeUrl('')
    setGptSecretKey('')

    expect(getGptBridgeUrl()).toBe(DEFAULT_GPT_BRIDGE_URL)
    expect(getGptSecretKey()).toBe(DEFAULT_GPT_SECRET_KEY)
  })

  it('toggles auto-sync flag in localStorage', () => {
    expect(isGptAutoSyncEnabled()).toBe(true)

    setGptAutoSyncEnabled(false)
    expect(isGptAutoSyncEnabled()).toBe(false)

    setGptAutoSyncEnabled(true)
    expect(isGptAutoSyncEnabled()).toBe(true)
  })

  it('executes push sync immediately with force: true and updates status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await syncGptCloudSnapshot(mockEvents, { force: true })

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

  it('pulls and merges new events from cloud correctly', async () => {
    const cloudEvents = [
      {
        id: 'gpt-evt-1',
        date: '2026-10-18',
        title: '跟老婆看電影',
        detail: '在信義威秀看院線新片',
        category: '生活',
        tags: ['ChatGPT生活秘書'],
        updatedAt: '2026-10-18T12:00:00Z',
      },
    ]

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events: cloudEvents }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const localDb: Event[] = []
    const mockRepo: EventRepository = {
      getAll: vi.fn().mockImplementation(async () => [...localDb]),
      getById: vi.fn().mockImplementation(async (id: string) => localDb.find((e) => e.id === id)),
      search: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockImplementation(async (evt: Event) => {
        localDb.push(evt)
        return evt
      }),
      update: vi.fn().mockImplementation(async (_id: string, evt: Event) => {
        const idx = localDb.findIndex((e) => e.id === evt.id)
        if (idx !== -1) localDb[idx] = evt
        return evt
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      replaceAll: vi.fn().mockImplementation(async (events: Event[]) => {
        localDb.length = 0
        localDb.push(...events)
      }),
    }

    const pullResult = await pullGptCloudEvents(mockRepo)

    expect(pullResult.success).toBe(true)
    expect(pullResult.pulledCount).toBe(1)
    expect(pullResult.addedCount).toBe(1)
    expect(localDb).toHaveLength(1)
    expect(localDb[0].title).toBe('跟老婆看電影')
    expect(localDb[0].date).toBe('2026-10-18')

    const pullInfo = getLastGptPullInfo()
    expect(pullInfo.status).toBe('success')
    expect(pullInfo.addedCount).toBe(1)
    expect(isGptPulling()).toBe(false)
  })

  it('pulls and deletes events locally when marked in deletedIds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        events: [],
        deletedIds: ['evt-to-delete'],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const localDb: Event[] = [
      {
        id: 'evt-to-delete',
        date: '2026-10-18',
        title: '老婆感冒',
        detail: '看醫生拿藥',
        category: '生活',
        tags: [],
        attachmentIds: [],
        createdAt: '2026-10-18T10:00:00Z',
        updatedAt: '2026-10-18T10:00:00Z',
      },
      {
        id: 'evt-to-keep',
        date: '2026-10-18',
        title: '跟老婆看電影',
        detail: '看院線片',
        category: '生活',
        tags: [],
        attachmentIds: [],
        createdAt: '2026-10-18T12:00:00Z',
        updatedAt: '2026-10-18T12:00:00Z',
      },
    ]

    const mockRepo: EventRepository = {
      getAll: vi.fn().mockImplementation(async () => [...localDb]),
      getById: vi.fn().mockImplementation(async (id: string) => localDb.find((e) => e.id === id)),
      search: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockImplementation(async (evt: Event) => {
        localDb.push(evt)
        return evt
      }),
      update: vi.fn().mockImplementation(async (_id: string, evt: Event) => {
        const idx = localDb.findIndex((e) => e.id === evt.id)
        if (idx !== -1) localDb[idx] = evt
        return evt
      }),
      delete: vi.fn().mockImplementation(async (id: string) => {
        const idx = localDb.findIndex((e) => e.id === id)
        if (idx !== -1) localDb.splice(idx, 1)
      }),
      replaceAll: vi.fn().mockImplementation(async (events: Event[]) => {
        localDb.length = 0
        localDb.push(...events)
      }),
    }

    const pullResult = await pullGptCloudEvents(mockRepo)

    expect(pullResult.success).toBe(true)
    expect(pullResult.deletedCount).toBe(1)
    expect(localDb).toHaveLength(1)
    expect(localDb[0].id).toBe('evt-to-keep')
  })

  it('records and returns local tombstones', () => {
    clearLocalTombstones()
    expect(getLocalTombstones()).toHaveLength(0)

    recordLocalTombstone({ id: 'evt-del-1', title: '和老婆吃四川火鍋', date: '2026-10-18' })
    const tombstones = getLocalTombstones()
    expect(tombstones).toHaveLength(1)
    expect(tombstones[0].id).toBe('evt-del-1')
    expect(tombstones[0].title).toBe('和老婆吃四川火鍋')
    expect(tombstones[0].date).toBe('2026-10-18')
  })

  it('pulls and deletes locally by title and date even when ID mismatches (solves四川火鍋sync anomaly)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        events: [],
        deletedIds: ['gpt-990ca22d-14af-4861-9e47-152a9efa6cf2'],
        deletedRecords: [
          {
            id: 'gpt-990ca22d-14af-4861-9e47-152a9efa6cf2',
            title: '和老婆吃四川火鍋',
            date: '2026-10-18',
            deletedAt: '2026-10-19T00:00:00Z',
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    // Local DB has local UUID, NOT the gpt- ID
    const localDb: Event[] = [
      {
        id: 'local-uuid-original-huoguo',
        date: '2026-10-18',
        title: '和老婆吃四川火鍋',
        detail: '麻辣鴨血',
        category: '生活',
        tags: [],
        attachmentIds: [],
        createdAt: '2026-10-18T10:00:00Z',
        updatedAt: '2026-10-18T10:00:00Z',
      },
    ]

    const mockRepo: EventRepository = {
      getAll: vi.fn().mockImplementation(async () => [...localDb]),
      getById: vi.fn().mockImplementation(async (id: string) => localDb.find((e) => e.id === id)),
      search: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockImplementation(async (evt: Event) => {
        localDb.push(evt)
        return evt
      }),
      update: vi.fn().mockImplementation(async (_id: string, evt: Event) => {
        const idx = localDb.findIndex((e) => e.id === evt.id)
        if (idx !== -1) localDb[idx] = evt
        return evt
      }),
      delete: vi.fn().mockImplementation(async (id: string) => {
        const idx = localDb.findIndex((e) => e.id === id)
        if (idx !== -1) localDb.splice(idx, 1)
      }),
      replaceAll: vi.fn().mockImplementation(async (events: Event[]) => {
        localDb.length = 0
        localDb.push(...events)
      }),
    }

    const pullResult = await pullGptCloudEvents(mockRepo)

    expect(pullResult.success).toBe(true)
    expect(pullResult.deletedCount).toBe(1)
    expect(localDb).toHaveLength(0) // Successfully deleted despite ID mismatch!
  })

  it('pulls target voice test event and records full diagnostics and type breakdown', async () => {
    const targetEventId = 'gpt-8fbcde0d-2edc-4224-b08b-5493febe3ab5'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ok',
          count: 3,
          events: [
            {
              id: targetEventId,
              date: '2026-10-20',
              title: 'EdenNote 語音測試',
              detail: '今天進行 EdenNote 語音測試。',
              category: '測試',
              recordType: 'daily',
              updatedAt: '2026-10-20T08:04:25.824Z',
            },
            {
              id: 'note-1',
              title: '買咖啡',
              recordType: 'note',
              category: '待辦',
            },
            {
              id: 'anniv-1',
              title: '結婚紀念日',
              date: '05-20',
              recordType: 'anniversary',
              category: '紀念日',
            },
          ],
          deletedIds: [],
        }),
      })
    )

    const localDb: Event[] = []
    const mockRepo: EventRepository = {
      getAll: vi.fn().mockImplementation(async () => [...localDb]),
      getById: vi.fn().mockImplementation(async (id: string) => localDb.find((e) => e.id === id)),
      search: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockImplementation(async (evt: Event) => {
        localDb.push(evt)
        return evt
      }),
      update: vi.fn().mockImplementation(async (_id: string, evt: Event) => {
        const idx = localDb.findIndex((e) => e.id === evt.id)
        if (idx !== -1) localDb[idx] = evt
        return evt
      }),
      delete: vi.fn().mockImplementation(async (id: string) => {
        const idx = localDb.findIndex((e) => e.id === id)
        if (idx !== -1) localDb.splice(idx, 1)
      }),
      replaceAll: vi.fn().mockImplementation(async (events: Event[]) => {
        localDb.length = 0
        localDb.push(...events)
      }),
    }

    const res = await pullGptCloudEvents(mockRepo)

    expect(res.success).toBe(true)
    expect(res.pulledCount).toBe(3)
    expect(res.addedCount).toBe(3)
    expect(res.cloudBreakdown).toEqual({ daily: 1, note: 1, anniversary: 1 })
    expect(res.localAfterBreakdown).toEqual({ daily: 1, note: 1, anniversary: 1 })

    const foundTarget = localDb.find((e) => e.id === targetEventId)
    expect(foundTarget).toBeDefined()
    expect(foundTarget?.title).toBe('EdenNote 語音測試')
    expect(foundTarget?.date).toBe('2026-10-20')
    expect(foundTarget?.recordType).toBe('daily')

    const diag = getLatestSyncDiagnostics()
    expect(diag).toBeDefined()
    expect(diag?.targetVerified).toBe(true)
    expect(diag?.targetRecord?.id).toBe(targetEventId)
    expect(diag?.cloudTotal).toBe(3)
    expect(diag?.localAfterTotal).toBe(3)
  })

  it('does not overwrite an existing event with the same title on a different date', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ok',
          count: 1,
          events: [
            {
              id: 'cloud-hualien-2026',
              date: '2026-05-01',
              title: '回花蓮',
              detail: '搭自強號',
              category: '生活',
              recordType: 'daily',
            },
          ],
          deletedIds: [],
        }),
      })
    )

    const existing2025: Event = {
      id: 'local-hualien-2025',
      date: '2025-01-01',
      title: '回花蓮',
      detail: '開車返鄉',
      category: '生活',
      recordType: 'daily',
      tags: [],
      attachmentIds: [],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }
    const localDb: Event[] = [existing2025]

    const mockRepo: EventRepository = {
      getAll: vi.fn().mockImplementation(async () => [...localDb]),
      getById: vi.fn().mockImplementation(async (id: string) => localDb.find((e) => e.id === id)),
      search: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockImplementation(async (evt: Event) => {
        localDb.push(evt)
        return evt
      }),
      update: vi.fn().mockImplementation(async (_id: string, evt: Event) => {
        const idx = localDb.findIndex((e) => e.id === evt.id)
        if (idx !== -1) localDb[idx] = evt
        return evt
      }),
      delete: vi.fn().mockImplementation(async (id: string) => {
        const idx = localDb.findIndex((e) => e.id === id)
        if (idx !== -1) localDb.splice(idx, 1)
      }),
      replaceAll: vi.fn().mockImplementation(async (events: Event[]) => {
        localDb.length = 0
        localDb.push(...events)
      }),
    }

    const res = await pullGptCloudEvents(mockRepo)

    expect(res.success).toBe(true)
    expect(res.addedCount).toBe(1)
    expect(localDb).toHaveLength(2)
    // The original 2025 record is preserved!
    expect(localDb.find((e) => e.id === 'local-hualien-2025')?.date).toBe('2025-01-01')
    // The new 2026 record is added!
    expect(localDb.find((e) => e.id === 'cloud-hualien-2026')?.date).toBe('2026-05-01')
  })
})
