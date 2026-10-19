import type { Event } from '../models/Event'
import type { EventRepository } from '../repositories/EventRepository'
import { syncWidgetSnapshot } from './widgetBridge'

export const GPT_BRIDGE_URL_KEY = 'edennote_gpt_bridge_url'
export const GPT_SECRET_KEY_KEY = 'edennote_gpt_secret_key'
export const GPT_AUTO_SYNC_ENABLED_KEY = 'edennote_gpt_auto_sync_enabled'
export const GPT_LAST_SYNC_TIME_KEY = 'edennote_gpt_last_sync_time'
export const GPT_LAST_SYNC_STATUS_KEY = 'edennote_gpt_last_sync_status'
export const GPT_LAST_PULL_TIME_KEY = 'edennote_gpt_last_pull_time'
export const GPT_LAST_PULL_STATUS_KEY = 'edennote_gpt_last_pull_status'
export const GPT_LAST_PULL_ADDED_KEY = 'edennote_gpt_last_pull_added'

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

export const getLastGptPullInfo = (): { time: string | null; status: string | null; addedCount: number | null } => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { time: null, status: null, addedCount: null }
  }
  const time = localStorage.getItem(GPT_LAST_PULL_TIME_KEY)
  const status = localStorage.getItem(GPT_LAST_PULL_STATUS_KEY)
  let addedCount: number | null = null
  try {
    const rawAdded = localStorage.getItem(GPT_LAST_PULL_ADDED_KEY)
    if (rawAdded) addedCount = Number(rawAdded)
  } catch {
    // ignore
  }
  return { time, status, addedCount }
}

let isCurrentlySyncing = false
let isCurrentlyPulling = false
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null
let hasPendingRetry = false
let lastCachedEvents: Event[] | null = null

export const isGptSyncing = (): boolean => isCurrentlySyncing
export const isGptPulling = (): boolean => isCurrentlyPulling

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

export interface PullCloudEventsResult {
  success: boolean
  pulledCount: number
  addedCount: number
  updatedCount: number
  error?: string
}

interface RawCloudEvent {
  id?: string
  date?: string
  title?: string
  detail?: string
  category?: string
  recordType?: 'daily' | 'note' | 'anniversary'
  tags?: string[] | string
  calendarType?: 'solar' | 'lunar'
  lunarMonth?: number
  lunarDay?: number
  updatedAt?: string
  createdAt?: string
  lastEditedAt?: string
}

/**
 * Pull latest events added or updated in Google Apps Script Cloud storage (e.g. by ChatGPT assistant)
 * and safely merge into local IndexedDB without creating duplicate records.
 */
export const pullGptCloudEvents = async (
  repo: EventRepository
): Promise<PullCloudEventsResult> => {
  const url = getGptBridgeUrl().trim()
  const key = getGptSecretKey().trim()

  if (!url) {
    return { success: false, pulledCount: 0, addedCount: 0, updatedCount: 0, error: '未設定 Google Apps Script 網址' }
  }

  if (isCurrentlyPulling) {
    return { success: false, pulledCount: 0, addedCount: 0, updatedCount: 0, error: '正在拉取中' }
  }

  isCurrentlyPulling = true
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('edennote:gpt-pull-started'))
  }

  try {
    const targetEndpoint = `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`
    const response = await fetch(targetEndpoint, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = (await response.json()) as { events?: RawCloudEvent[] }
    const cloudEvents = Array.isArray(data?.events) ? data.events : []

    const localEvents = await repo.getAll()
    const localMap = new Map<string, Event>(localEvents.map((evt) => [evt.id, evt]))

    let addedCount = 0
    let updatedCount = 0

    for (const ce of cloudEvents) {
      if (!ce || typeof ce !== 'object') continue
      const ceId = ce.id?.trim() || ''

      const existingById = ceId ? localMap.get(ceId) : undefined

      if (existingById) {
        // Compare updatedAt timestamp
        const cloudTime = ce.updatedAt ? new Date(ce.updatedAt).getTime() : 0
        const localTime = existingById.updatedAt ? new Date(existingById.updatedAt).getTime() : 0

        if (cloudTime > localTime) {
          const updatedEvent: Event = {
            ...existingById,
            title: ce.title !== undefined ? ce.title : existingById.title,
            detail: ce.detail !== undefined ? ce.detail : existingById.detail,
            category: ce.category !== undefined ? ce.category : existingById.category,
            date: ce.date !== undefined ? ce.date : existingById.date,
            recordType: ce.recordType || existingById.recordType,
            tags: Array.isArray(ce.tags)
              ? ce.tags
              : typeof ce.tags === 'string'
              ? ce.tags.split(',').map((t) => t.trim()).filter(Boolean)
              : existingById.tags,
            calendarType: ce.calendarType || existingById.calendarType,
            lunarMonth: ce.lunarMonth !== undefined ? ce.lunarMonth : existingById.lunarMonth,
            lunarDay: ce.lunarDay !== undefined ? ce.lunarDay : existingById.lunarDay,
            updatedAt: ce.updatedAt || new Date().toISOString(),
          }
          await repo.update(updatedEvent)
          localMap.set(existingById.id, updatedEvent)
          updatedCount++
        }
      } else {
        // Check for duplicate title + date + detail
        const trimmedTitle = (ce.title || '').trim()
        const trimmedDate = (ce.date || '').trim()
        const trimmedDetail = (ce.detail || '').trim()

        const duplicate = localEvents.find(
          (evt) =>
            (evt.date || '').trim() === trimmedDate &&
            (evt.title || '').trim() === trimmedTitle &&
            (evt.detail || '').trim() === trimmedDetail
        )

        if (!duplicate) {
          const generatedId =
            ceId ||
            (typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `gpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)

          const tagsArray = Array.isArray(ce.tags)
            ? ce.tags
            : typeof ce.tags === 'string'
            ? ce.tags.split(',').map((t) => t.trim()).filter(Boolean)
            : ['ChatGPT生活秘書']

          const newEvent: Event = {
            id: generatedId,
            date: trimmedDate || new Date().toISOString().slice(0, 10),
            title: trimmedTitle || '語音記事',
            detail: trimmedDetail,
            category: (ce.category || '').trim() || '生活',
            recordType: ce.recordType || 'daily',
            tags: tagsArray.length > 0 ? tagsArray : ['ChatGPT生活秘書'],
            attachmentIds: [],
            createdAt: ce.createdAt || ce.updatedAt || new Date().toISOString(),
            updatedAt: ce.updatedAt || new Date().toISOString(),
            calendarType: ce.calendarType,
            lunarMonth: ce.lunarMonth,
            lunarDay: ce.lunarDay,
          }

          await repo.add(newEvent)
          localMap.set(newEvent.id, newEvent)
          addedCount++
        }
      }
    }

    if (addedCount > 0 || updatedCount > 0) {
      const refreshedEvents = await repo.getAll()
      void syncWidgetSnapshot(refreshedEvents)
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('edennote:events-updated', { detail: { addedCount, updatedCount } }))
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const nowStr = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      localStorage.setItem(GPT_LAST_PULL_TIME_KEY, nowStr)
      localStorage.setItem(GPT_LAST_PULL_STATUS_KEY, 'success')
      localStorage.setItem(GPT_LAST_PULL_ADDED_KEY, String(addedCount))
      window.dispatchEvent(
        new CustomEvent('edennote:gpt-pull-completed', {
          detail: { success: true, pulledCount: cloudEvents.length, addedCount, updatedCount },
        })
      )
    }

    return {
      success: true,
      pulledCount: cloudEvents.length,
      addedCount,
      updatedCount,
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(GPT_LAST_PULL_STATUS_KEY, `error: ${errorMsg}`)
      window.dispatchEvent(
        new CustomEvent('edennote:gpt-pull-completed', { detail: { success: false, error: errorMsg } })
      )
    }
    return { success: false, pulledCount: 0, addedCount: 0, updatedCount: 0, error: errorMsg }
  } finally {
    isCurrentlyPulling = false
  }
}

/**
 * Complete Google Apps Script template code supporting 2-way sync:
 * Reading, Full backup from EdenNote, and Add Event from ChatGPT assistant.
 */
export const GAS_CODE_TEMPLATE = `/**
 * EdenNote 雲端生活秘書 - Google Apps Script (雙向同步版)
 * 支援功能：
 * 1. EdenNote App 全自動推播/覆寫 (POST /exec)
 * 2. ChatGPT 雲端生活秘書即時查詢所有記事 (GET /exec)
 * 3. ChatGPT 雲端生活秘書自動新增記事 (POST 或 GET action=add)
 */

const SECRET_KEY = "eden_secret_888"; // 請與 EdenNote 設定中的 Secret Key 一致
const FILE_NAME = "edennote_data.json";

function getOrCreateStorageFile() {
  const files = DriveApp.getFilesByName(FILE_NAME);
  if (files.hasNext()) {
    return files.next();
  }
  return DriveApp.createFile(FILE_NAME, JSON.stringify({ events: [], updatedAt: new Date().toISOString() }), MimeType.PLAIN_TEXT);
}

// 處理 GET 請求：支援讀取所有記事 或 ChatGPT 透過 GET 參數直接新增記事
function doGet(e) {
  try {
    const key = e && e.parameter && e.parameter.key;
    if (key !== SECRET_KEY) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unauthorized key" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const action = e && e.parameter && e.parameter.action;

    // 支援 ChatGPT 透過 GET 快速新增記事
    if (action === "add" || action === "add_event") {
      const file = getOrCreateStorageFile();
      const content = file.getBlob().getDataAsString();
      let db = { events: [] };
      try { db = JSON.parse(content); } catch (err) {}
      if (!Array.isArray(db.events)) db.events = [];

      const newEvent = {
        id: "gpt-" + Utilities.getUuid(),
        date: e.parameter.date || Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd"),
        title: e.parameter.title || "語音記事",
        detail: e.parameter.detail || "",
        category: e.parameter.category || "生活",
        recordType: e.parameter.recordType || "daily",
        tags: e.parameter.tags ? e.parameter.tags.split(",") : ["ChatGPT生活秘書"],
        updatedAt: new Date().toISOString()
      };

      db.events.push(newEvent);
      db.updatedAt = new Date().toISOString();
      file.setContent(JSON.stringify(db));

      return ContentService.createTextOutput(JSON.stringify({
        status: "ok",
        message: "已成功記錄至 EdenNote 雲端！",
        event: newEvent,
        totalCount: db.events.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 預設：讀取所有記事
    const file = getOrCreateStorageFile();
    const content = file.getBlob().getDataAsString();
    let db = { events: [] };
    try { db = JSON.parse(content); } catch (err) {}

    return ContentService.createTextOutput(JSON.stringify({
      status: "ok",
      count: db.events ? db.events.length : 0,
      updatedAt: db.updatedAt || "",
      events: db.events || []
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 處理 POST 請求：支援 EdenNote 全量同步 或 ChatGPT 透過 POST JSON 新增單筆記事
function doPost(e) {
  try {
    const key = e && e.parameter && e.parameter.key;
    if (key !== SECRET_KEY) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unauthorized key" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const payload = JSON.parse(e.postData.contents);
    const file = getOrCreateStorageFile();

    // 情況 A：ChatGPT 透過 POST 新增單筆記事
    if (payload.action === "add_event" || payload.action === "add" || payload.event) {
      const content = file.getBlob().getDataAsString();
      let db = { events: [] };
      try { db = JSON.parse(content); } catch (err) {}
      if (!Array.isArray(db.events)) db.events = [];

      const raw = payload.event || payload;
      const newEvent = {
        id: raw.id || "gpt-" + Utilities.getUuid(),
        date: raw.date || Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd"),
        title: raw.title || "語音記事",
        detail: raw.detail || "",
        category: raw.category || "生活",
        recordType: raw.recordType || "daily",
        tags: Array.isArray(raw.tags) ? raw.tags : (raw.tags ? [raw.tags] : ["ChatGPT生活秘書"]),
        updatedAt: new Date().toISOString()
      };

      db.events.push(newEvent);
      db.updatedAt = new Date().toISOString();
      file.setContent(JSON.stringify(db));

      return ContentService.createTextOutput(JSON.stringify({
        status: "ok",
        message: "已成功記錄至 EdenNote 雲端！",
        event: newEvent,
        totalCount: db.events.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 情況 B：EdenNote App 全量推播同步
    if (payload.events && Array.isArray(payload.events)) {
      file.setContent(JSON.stringify(payload));
      return ContentService.createTextOutput(JSON.stringify({
        status: "ok",
        message: "EdenNote 全量同步成功",
        count: payload.events.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Invalid payload format" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`

export const CHATGPT_ACTIONS_SCHEMA = `openapi: 3.1.0
info:
  title: EdenNote 生活秘書雲端 API
  description: 供 ChatGPT 生活秘書即時讀取與自動寫入 EdenNote 個人記事
  version: 2.0.0
servers:
  - url: https://script.google.com/macros/s/AKfycbw9VzMUGW9ASUgms7_xb6r_iPfX-cD7uHbHoFavkmIbJSntOCpNM-kHajKyimXwXngf
paths:
  /exec:
    get:
      operationId: getEvents
      summary: 查詢所有記事或透過 GET 新增記事
      parameters:
        - name: key
          in: query
          required: true
          schema:
            type: string
            default: eden_secret_888
        - name: action
          in: query
          required: false
          schema:
            type: string
            enum: [get, add]
        - name: title
          in: query
          description: 記事標題（例如：跟老婆看電影）
          required: false
          schema:
            type: string
        - name: date
          in: query
          description: 日期 YYYY-MM-DD（例如昨天請換算為真實日期）
          required: false
          schema:
            type: string
        - name: category
          in: query
          description: 分類（例如：生活、娛樂、工作、家庭、健康）
          required: false
          schema:
            type: string
        - name: detail
          in: query
          description: 詳細內容或備註
          required: false
          schema:
            type: string
        - name: tags
          in: query
          description: 標籤逗號分隔（例如：電影,約會）
          required: false
          schema:
            type: string
      responses:
        '200':
          description: 成功回應
          content:
            application/json:
              schema:
                type: object
    post:
      operationId: addEvent
      summary: 自動新增一筆記事至 EdenNote
      parameters:
        - name: key
          in: query
          required: true
          schema:
            type: string
            default: eden_secret_888
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                action:
                  type: string
                  default: add_event
                event:
                  type: object
                  required:
                    - title
                    - date
                  properties:
                    title:
                      type: string
                      description: 記事標題
                    date:
                      type: string
                      description: 格式 YYYY-MM-DD
                    category:
                      type: string
                      description: 分類
                    detail:
                      type: string
                      description: 詳細內容說明
                    tags:
                      type: array
                      items:
                        type: string
      responses:
        '200':
          description: 新增成功
          content:
            application/json:
              schema:
                type: object`

export const CHATGPT_INSTRUCTIONS_PROMPT = `你是 Eden 的專屬「EdenNote 生活秘書」。
你的任務是協助 Eden 管理生活回憶、記事、工作、排程與慢箋。

【兩大核心任務】：
1. 查詢與回答（查詢記事）：
   - 當 Eden 詢問以前發生過什麼、查待辦事項、慢箋何時領藥或回憶時，呼叫 getEvents 取得最新記事，親切回答。

2. 自動記錄（寫入記事）：
   - 當 Eden 說「幫我記下...」、「昨天跟老婆看電影」、「明天早上要繳電費」等需求時：
     a. 分析相對時間（例如：「昨天」請推算換算為對應的真實 YYYY-MM-DD；「明天」亦同）。
     b. 自動提煉標題（例如：跟老婆看電影）、詳細內容（若有提及細節或觀看電影名稱）、合適分類（例如：生活、娛樂、工作、家庭）。
     c. 主動呼叫 addEvent（或 getEvents action='add'）將這筆記事寫入 EdenNote！
     d. 成功後溫暖回覆：「已為您記錄到 EdenNote 囉！📅 日期：... 📝 標題：... 🏷️ 分類：...」`
