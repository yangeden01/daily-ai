import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI } from '@google/genai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = Number(process.env.PORT) || 3000
const isProd = process.env.NODE_ENV === 'production'

app.use(cors())
app.use(express.json({ limit: '15mb' }))

// Initialize GoogleGenAI client as recommended in SKILL.md
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
})

interface EventItem {
  id: string
  date: string
  title: string
  detail?: string
  category?: string
  amount?: number
  tags?: string[]
  recordType?: string
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  })
})

// AI Chat API route
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages = [], events = [], enableSearch = true } = req.body as {
      messages: ChatMessage[]
      events: EventItem[]
      enableSearch?: boolean
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' })
    }

    const userApiKey = (req.headers['x-gemini-api-key'] as string) || (req.body.apiKey as string)
    const apiKey = userApiKey?.trim() || process.env.GEMINI_API_KEY || ''
    if (!apiKey) {
      res.status(503).json({
        error: 'GEMINI_API_KEY 未設定，無法啟用雲端 Gemini AI',
      })
      return
    }

    const totalCount = events.length

    // Temporal context anchor (Asia/Taipei UTC+8)
    const now = new Date()
    const twIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
    const [y, m, d] = twIso.split('-').map(Number)
    const twToday = new Date(y, m - 1, d)
    const dayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const weekday = dayNames[twToday.getDay()]

    const dayOfWeek = twToday.getDay() || 7 // 1=Mon ... 7=Sun
    const monday = new Date(twToday)
    monday.setDate(twToday.getDate() - dayOfWeek + 1)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const lastMonday = new Date(monday)
    lastMonday.setDate(monday.getDate() - 7)
    const lastSunday = new Date(sunday)
    lastSunday.setDate(sunday.getDate() - 7)

    const nextMonday = new Date(monday)
    nextMonday.setDate(monday.getDate() + 7)
    const nextSunday = new Date(sunday)
    nextSunday.setDate(sunday.getDate() + 7)

    const fmtZh = (dt: Date) => `${dt.getMonth() + 1} 月 ${dt.getDate()} 日`
    const fmtIso = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`

    // Sort events by date descending
    const sortedEvents = [...events].sort((a, b) => {
      const da = a.date || ''
      const db = b.date || ''
      return db.localeCompare(da)
    })

    // Create a compact text representation for the model
    const eventsFormatted = sortedEvents
      .map((evt, idx) => {
        const parts = [
          `[${evt.date || '無日期'}]`,
          evt.category ? `(${evt.category})` : '',
          evt.title || '無標題',
        ]
        if (evt.amount !== undefined && evt.amount !== null) {
          parts.push(`金額:${evt.amount}`)
        }
        if (evt.tags && evt.tags.length > 0) {
          parts.push(`標籤:${evt.tags.join(',')}`)
        }
        if (evt.detail) {
          const cleanDetail = evt.detail.replace(/\r?\n/g, ' ').slice(0, 160)
          parts.push(`詳情:${cleanDetail}`)
        }
        return `${idx + 1}. [ID:${evt.id}] ${parts.filter(Boolean).join(' ')}`
      })
      .join('\n')

    const systemPrompt = `你是一個專業、親切且嚴謹的個人生活與工作智慧助理，名稱為「EdenNote AI 助理」。
你擁有讀取與深入分析使用者「EdenNote 資料庫」的專屬權限，並且具備強大的即時聯網搜尋與常識推理能力。

【當前時間基準與時間範圍】：
- 今天是：${twIso}（${weekday}）
- 上週區間：約 ${fmtZh(lastMonday)} 至 ${fmtZh(lastSunday)}（${fmtIso(lastMonday)} ~ ${fmtIso(lastSunday)}，或過去7天 ${fmtZh(new Date(twToday.getTime() - 7 * 86400000))} 至 ${fmtZh(new Date(twToday.getTime() - 86400000))}）
- 本週區間：約 ${fmtZh(monday)} 至 ${fmtZh(sunday)}（${fmtIso(monday)} ~ ${fmtIso(sunday)}）
- 下週區間：約 ${fmtZh(nextMonday)} 至 ${fmtZh(nextSunday)}（${fmtIso(nextMonday)} ~ ${fmtIso(nextSunday)}）
- 當前月份：${y} 年 ${m} 月

【使用者的 EdenNote 本機資料庫現況】
資料庫共有 ${totalCount} 筆紀錄：
${eventsFormatted || '（目前資料庫中尚無任何事件紀錄）'}

【你的任務與核心能力】
1. 深入分析與計算 EdenNote 內的資料：
   - 紀念日與生日處理規範（每年循環重要事件）：
     * EdenNote 中的【生日】與【紀念日】紀錄為每年循環發生的事件，其在資料庫中的日期格式通常為 [YYYY-MM-DD] 或 [MM-DD]（例如 [07-01] 代表每年 7 月 1 日，[1990-08-19] 代表每年 8 月 19 日）。
     * 當使用者詢問「上周那些人生日」、「這週誰生日」、「下個月有哪些紀念日」等問題時：
       a. 請將所有生日紀錄的【月日（MM-DD）】對齊到當前年份進行日期區間比對。
       b. 若在該目標區間內「有」人生日：請清晰列出該人員姓名、日期、備註/關係與已過/剩餘天數。
       c. 若在該目標區間內「沒有任何人」登記生日：請務必正面、明確且親切地告知使用者，例如：
          「在您的個人日曆與紀錄中，上週（${fmtZh(lastMonday)} 至 ${fmtZh(lastSunday)}）並沒有登記任何生日活動或提醒。
          如果您是指特定群組、同事圈，或是某些公眾人物／名人的生日，請告訴我是哪方面，我再為您查詢！」
          ⚠️ 絕對不要無差別列出全年度所有 70 多筆名單！
   - 歷年加薪與薪資變動：能搜尋所有薪資、加薪、調薪、工作待遇等紀錄，列出各年份/月份的薪水數字，計算每次加薪金額、每次調薪比例（%）、歷年加薪速率或年化成長率（CAGR = (最新薪資/初始薪資)^(1/年數) - 1），並使用清晰整齊的 Markdown 表格呈現！
   - 加班與工作時數：搜尋加班、工時、專案、請假、值班等關鍵字，統計總加班時數、頻率或工時趨勢。
   - 財務與消費支出：針對含有金額（amount）的紀錄，進行類別加總、月度或年度支出統計、最大筆開銷分析。
   - 重點記事歸納：依據使用者指定的時間段或分類，條理分明地歸納工作心得、生活摘要與待辦進度。

2. 嚴格區分「個人資料查詢」與「外部即時/世界常識問題」：
   - 【個人生活/工作/記事問題】（例如薪資、調薪、工時、加班、開銷、看牙醫、特定日期的記事、備忘）：
     請務必從上方的【使用者的 EdenNote 本機資料庫現況】中精確搜尋匹配紀錄，標註出 [日期]、分類、標題、金額與詳情，並給出清晰表格或精確計算。
   - 【外部即時/新聞/賽事/通識問題】（例如「今天亞運戰績」、「今天天氣如何」、「NBA 賽程」、「國際要聞」、「科普生活常識」）：
     請直接使用 Google 搜尋工具或模型通識知識進行直接、正面且完整的回答，列出最新比分、新聞快訊或賽程重點！
     ⚠️ 切勿將外部問題生硬地套入個人筆記搜尋，絕對不要回答「我在您的 EdenNote 資料庫找不到亞運紀錄」！
   - 【綜合比對問題】（例如「我的加薪幅度有跟上市場平均嗎？」）：
     先從個人紀錄計算調薪幅度，再利用 Google 搜尋行政院主計總處、科技業調薪行情或通膨率進行客觀比較。

3. 回覆格式要求：
   - 必須使用台灣習慣的「繁體中文」回答。
   - 語氣親切、專業、富有洞察力與對話感（如官方 Gemini App 對話體驗）。
   - 若有計算過程，請列出清楚的算式與數據來源（例如哪年哪月的哪筆紀錄）。
   - 善用 Markdown 排版：小標題、粗體、清單、Markdown 表格。
   - 若引用到特定個人事件，請標示出日期與標題，並標記格式 [事件：標題 (日期)](event:ID)，以便前端高亮與點擊。`

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })

    // Build contents array for gemini-3.8-flash
    const contents: Array<{
      role: 'user' | 'model'
      parts: Array<{ text: string }>
    }> = []

    for (const msg of messages) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })
    }

    const config: {
      systemInstruction: string
      temperature: number
      tools?: Array<{ googleSearch: Record<string, never> }>
    } = {
      systemInstruction: systemPrompt,
      temperature: 0.7,
    }

    if (enableSearch) {
      config.tools = [{ googleSearch: {} }]
    }

    let response
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config,
      })
    } catch (apiErr: unknown) {
      const errObj = apiErr as { status?: number; message?: string }
      console.error('Gemini API call failed:', errObj)

      const errMsg = typeof errObj?.message === 'string' ? errObj.message : String(apiErr)
      const isQuotaError =
        errObj?.status === 402 ||
        errObj?.status === 429 ||
        errMsg.includes('credits are depleted') ||
        errMsg.includes('402') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('Quota exceeded') ||
        errMsg.includes('quota')

      return res.status(isQuotaError ? 402 : (errObj?.status || 500)).json({
        error: isQuotaError
          ? 'GEMINI_QUOTA_DEPLETED'
          : errObj?.message || 'Gemini API 呼叫失敗',
        message: errObj?.message || '發生錯誤',
        raw: String(apiErr),
      })
    }

    const text = response.text || ''

    // Extract grounding metadata if any
    const candidate = response.candidates?.[0]
    const groundingMetadata = candidate?.groundingMetadata as
      | {
          groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>
          webSearchQueries?: string[]
        }
      | undefined

    const sources: Array<{ title: string; url: string }> = []

    if (groundingMetadata?.groundingChunks) {
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web?.uri) {
          sources.push({
            title: chunk.web.title || chunk.web.uri,
            url: chunk.web.uri,
          })
        }
      }
    }

    // Deduplicate sources by url
    const uniqueSources = Array.from(
      new Map(sources.map((s) => [s.url, s])).values()
    )

    return res.json({
      reply: text,
      sources: uniqueSources,
      searchQueries: groundingMetadata?.webSearchQueries || [],
    })
  } catch (err: unknown) {
    const error = err as Error
    console.error('Error handling /api/ai/chat:', error)
    return res.status(500).json({ error: error?.message || '伺服器內部錯誤' })
  }
})

// Setup Vite middleware in dev or static files in prod
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.resolve(__dirname, 'dist')
    app.use(express.static(distPath))
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'))
    })
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(
      `EdenNote Server running on http://0.0.0.0:${port} [mode: ${isProd ? 'production' : 'development'}]`
    )
  })
}

startServer().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
