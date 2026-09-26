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

    const totalCount = events.length

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
你擁有讀取與深入分析使用者「EdenNote 資料庫」的專屬權限。

【使用者的 EdenNote 本機資料庫現況】
資料庫共有 ${totalCount} 筆紀錄：
${eventsFormatted || '（目前資料庫中尚無任何事件紀錄）'}

【你的任務與核心能力】
1. 深入分析與計算 EdenNote 內的資料：
   - 歷年加薪與薪資變動：能搜尋所有薪資、加薪、調薪、工作待遇等紀錄，列出各年份/月份的薪水數字，計算每次加薪金額、每次調薪比例（%）、歷年加薪速率或年化成長率（CAGR = (最新薪資/初始薪資)^(1/年數) - 1），並使用清晰整齊的 Markdown 表格呈現！
   - 加班與工作時數：搜尋加班、工時、專案、請假、值班等關鍵字，統計總加班時數、頻率或工時趨勢。
   - 財務與消費支出：針對含有金額（amount）的紀錄，進行類別加總、月度或年度支出統計、最大筆開銷分析。
   - 紀念日與倒數提醒：推算重要紀念日天數、週年紀念、農曆/國曆換算。
   - 重點記事歸納：依據使用者指定的時間段或分類，條理分明地歸納工作心得、生活摘要與待辦進度。

2. Google 聯網比對（當啟用聯網搜尋或問題需要外部知識時）：
   - 使用者常會希望將自己的資料與外部客觀市場數據做比對（例如：比對目前加薪幅度 vs 台灣行政院主計總處或科技業平均調薪率、市場行情、通膨率 CPI 等）。
   - 請利用搜尋結果進行嚴謹客觀的比較分析，並明確引用參考來源。

3. 回覆格式要求：
   - 必須使用台灣習慣的「繁體中文」回答。
   - 語氣親切、專業、富有洞察力。
   - 若有計算過程，請列出清楚的算式與數據來源（例如哪年哪月的哪筆紀錄）。
   - 善用 Markdown 排版：小標題、粗體、清單、Markdown 表格。
   - 若引用到特定事件，請標示出日期與標題，並標記 event:ID（例如 [事件：加薪 5000 (2024-03-01)](event:ID)），以便使用者查看。
   - 若資料庫中沒有相關紀錄，請誠實告知，並給予建議（例如提示可在 Input 頁面如何記錄以便日後分析）。`

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

      const isQuotaError =
        errObj?.status === 402 ||
        (typeof errObj?.message === 'string' &&
          errObj.message.includes('credits are depleted')) ||
        errObj?.status === 429

      return res.status(errObj?.status || 500).json({
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
