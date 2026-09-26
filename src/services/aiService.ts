import type { Event } from '../models/Event'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sources?: Array<{ title: string; url: string }>
  referencedEventIds?: string[]
  isLocalFallback?: boolean
}

export interface SendMessageOptions {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  events: Event[]
  enableSearch?: boolean
}

export interface ChatResponse {
  reply: string
  sources?: Array<{ title: string; url: string }>
  searchQueries?: string[]
  isLocalFallback?: boolean
}

/**
 * Local analytical engine to handle data queries directly if Gemini quota is unavailable.
 */
export function localSmartAnalyze(prompt: string, events: Event[]): string {
  const p = prompt.toLowerCase()
  const currency = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 })

  // 1. 薪資與加薪分析
  if (p.includes('加薪') || p.includes('薪資') || p.includes('薪水') || p.includes('調薪') || p.includes('salary')) {
    const salaryEvents = events
      .filter((e) => {
        const text = `${e.title} ${e.detail} ${e.category} ${e.tags.join(' ')}`.toLowerCase()
        return text.includes('加薪') || text.includes('薪資') || text.includes('薪水') || text.includes('調薪') || text.includes('底薪') || text.includes('月薪')
      })
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))

    if (salaryEvents.length === 0) {
      return `### 📊 EdenNote 薪資與加薪資料分析\n\n目前在您的資料庫中尚未找到包含「薪資」、「加薪」或「調薪」關鍵字的紀錄。\n\n**💡 建議記錄方式：**\n您可以在 **Input** 頁面新增事件，例如：\n- 標題：「**年度考核調薪至 65,000**」\n- 分類：「**工作**」或「**薪資**」\n- 金額：「**65000**」\n- 標籤：「**#加薪 #薪資**」\n\n記錄後，隨時回來詢問我，即可為您自動計算加薪金額、每次調幅與歷年年化成長率（CAGR）！`
    }

    let report = `### 📊 歷年薪資與加薪記錄深入分析\n\n為您檢索到 **${salaryEvents.length} 筆** 與薪資/調薪相關的紀錄：\n\n`
    report += `| 日期 | 事件標題 | 分類 | 標記金額 | 備註說明 |\n`
    report += `| :--- | :--- | :---: | :---: | :--- |\n`

    const amountsWithDates: Array<{ date: string; amount: number; title: string; id: string }> = []

    for (const evt of salaryEvents) {
      const amtStr = evt.amount !== undefined ? currency.format(evt.amount) : '未標記'
      report += `| ${evt.date || '無日期'} | **${evt.title}** | ${evt.category} | ${amtStr} | ${evt.detail?.slice(0, 30) || '無'} |\n`

      // Try to extract numerical salary from amount or title
      if (evt.amount && evt.amount > 0) {
        amountsWithDates.push({ date: evt.date, amount: evt.amount, title: evt.title, id: evt.id })
      } else {
        const match = evt.title.match(/(\d+[\d,]*)/)
        if (match) {
          const parsed = Number(match[1].replace(/,/g, ''))
          if (parsed > 1000) {
            amountsWithDates.push({ date: evt.date, amount: parsed, title: evt.title, id: evt.id })
          }
        }
      }
    }

    if (amountsWithDates.length >= 2) {
      report += `\n#### 📈 薪資成長與調薪速率計算\n\n`
      const first = amountsWithDates[0]
      const last = amountsWithDates[amountsWithDates.length - 1]
      const diff = last.amount - first.amount
      const pct = ((diff / first.amount) * 100).toFixed(1)

      report += `- **起算基準**：${first.date}（${currency.format(first.amount)}）\n`
      report += `- **目前最新**：${last.date}（${currency.format(last.amount)}）\n`
      report += `- **累計調升金額**：**+${currency.format(diff)}**\n`
      report += `- **整體成長幅度**：**+${pct}%**\n`

      // Calculate annual growth if multi-year
      const y1 = Number(first.date.slice(0, 4))
      const y2 = Number(last.date.slice(0, 4))
      const years = y2 - y1
      if (years >= 1) {
        const cagr = ((Math.pow(last.amount / first.amount, 1 / years) - 1) * 100).toFixed(2)
        report += `- **年化複合成長率 (CAGR)**：約 **${cagr}% / 年**（跨度 ${years} 年）\n`
      }

      report += `\n每次調薪紀錄與變動：\n`
      for (let i = 1; i < amountsWithDates.length; i++) {
        const prev = amountsWithDates[i - 1]
        const curr = amountsWithDates[i]
        const stepDiff = curr.amount - prev.amount
        const stepPct = ((stepDiff / prev.amount) * 100).toFixed(1)
        const sign = stepDiff >= 0 ? '+' : ''
        report += `${i}. **${curr.date}**（${curr.title}）：較前次 ${sign}${currency.format(stepDiff)}（${sign}${stepPct}%）\n`
      }
    } else {
      report += `\n> 💡 **提示**：若要在往後計算加薪速率與 CAGR，建議在紀錄時於「**金額**」欄位填入調薪後的實際月薪（例如 60000），系統即可為您自動繪製跨年度成長曲線！`
    }

    return report
  }

  // 2. 加班與工時分析
  if (p.includes('加班') || p.includes('工時') || p.includes('值班') || p.includes('overtime')) {
    const otEvents = events.filter((e) => {
      const text = `${e.title} ${e.detail} ${e.category} ${e.tags.join(' ')}`.toLowerCase()
      return text.includes('加班') || text.includes('值班') || text.includes('工時') || text.includes('overtime')
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    if (otEvents.length === 0) {
      return `### ⏱️ EdenNote 加班與工時紀錄分析\n\n目前在您的資料庫中尚未找到與「加班」或「工時」相關的紀錄。\n\n**💡 建議記錄方式：**\n在 Daily 頁面新增，例如：\n- 標題：「**加班 3 小時 - 處理系統上線**」\n- 分類：「**工作**」\n- 標籤：「**#加班 #工時**」`
    }

    let totalHours = 0
    let report = `### ⏱️ 加班紀錄與工時統計\n\n共找到 **${otEvents.length} 筆** 加班相關紀錄：\n\n`
    report += `| 日期 | 事件標題 | 詳情摘要 |\n`
    report += `| :--- | :--- | :--- |\n`

    for (const evt of otEvents.slice(0, 15)) {
      report += `| ${evt.date || '無日期'} | **${evt.title}** | ${evt.detail?.slice(0, 40) || '無'} |\n`
      const match = `${evt.title} ${evt.detail}`.match(/(\d+(?:\.\d+)?)\s*(?:小時|hr|h)/i)
      if (match) {
        totalHours += parseFloat(match[1])
      }
    }

    report += `\n- **累計加班筆數**：${otEvents.length} 次\n`
    if (totalHours > 0) {
      report += `- **累計已標記時數**：約 **${totalHours} 小時**\n`
    }
    return report
  }

  // 3. 支出與花費統計
  if (p.includes('花費') || p.includes('支出') || p.includes('金額') || p.includes('消費') || p.includes('記帳') || p.includes('總共花了')) {
    const amountEvents = events.filter((e) => e.amount && e.amount > 0)
    if (amountEvents.length === 0) {
      return `### 💰 財務與消費支出分析\n\n目前資料庫中尚無包含「金額 (amount)」的事件紀錄。\n在 Input 記錄生活事件時填寫金額欄位，即可隨時由 AI 為您統計各類別消費！`
    }

    const totalAmount = amountEvents.reduce((sum, e) => sum + (e.amount || 0), 0)
    const categoryMap: Record<string, number> = {}
    for (const e of amountEvents) {
      const cat = e.category || '未分類'
      categoryMap[cat] = (categoryMap[cat] || 0) + (e.amount || 0)
    }

    const sortedCats = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])

    let report = `### 💰 財務與支出累計分析\n\n`
    report += `- **含有金額紀錄筆數**：${amountEvents.length} 筆\n`
    report += `- **累計總金額**：**${currency.format(totalAmount)}**\n\n`
    report += `#### 分類金額排行：\n`
    report += `| 分類 | 累計金額 | 佔比 |\n`
    report += `| :--- | :---: | :---: |\n`
    for (const [cat, sum] of sortedCats) {
      const pct = ((sum / totalAmount) * 100).toFixed(1)
      report += `| **${cat}** | ${currency.format(sum)} | ${pct}% |\n`
    }

    return report
  }

  // 4. 一般關鍵字檢索與資料庫總覽
  const matching = events.filter((e) => {
    const text = `${e.title} ${e.detail} ${e.category} ${e.date} ${e.tags.join(' ')}`.toLowerCase()
    return prompt.split(/\s+/).some((keyword) => keyword.length >= 2 && text.includes(keyword.toLowerCase()))
  }).slice(0, 10)

  if (matching.length > 0) {
    let report = `### 🔍 為您檢索 EdenNote 資料庫結果\n\n針對您的提問「**${prompt}**」，找到以下相關紀錄：\n\n`
    for (const e of matching) {
      const amt = e.amount !== undefined ? `（${currency.format(e.amount)}）` : ''
      report += `- **[${e.date || '無日期'}]**【${e.category}】**${e.title}** ${amt}\n`
      if (e.detail) {
        report += `  > ${e.detail.slice(0, 80)}\n`
      }
    }
    return report
  }

  // 預設資料庫統計狀態
  const total = events.length
  const dailyCount = events.filter((e) => !e.recordType || e.recordType === 'daily').length
  const noteCount = events.filter((e) => e.recordType === 'note').length
  const anniCount = events.filter((e) => e.recordType === 'anniversary').length

  return `### 🤖 EdenNote AI 資料庫分析助理\n\n您詢問了：「**${prompt}**」。\n\n目前 EdenNote 資料庫共有 **${total} 筆紀錄**：\n- 📅 **Daily 日常紀錄**：${dailyCount} 筆\n- 📝 **Notes 備忘記事**：${noteCount} 筆\n- 🎂 **紀念日**：${anniCount} 筆\n\n您可以試著詢問我：\n1. 「**分析歷年加薪紀錄與加薪速率**」\n2. 「**統計工作與加班時數**」\n3. 「**計算累計花費與各分類支出**」\n4. 「**整理最近一個月的重點工作紀錄**」\n5. 「**比對外部軟體工程師平均薪資行情**」`
}

/**
 * Send chat message to EdenNote AI backend with fallback.
 */
export async function sendChatMessage(options: SendMessageOptions): Promise<ChatResponse> {
  const { messages, events, enableSearch = true } = options
  const latestUserPrompt = messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || ''

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        events: events.map((e) => ({
          id: e.id,
          date: e.date,
          title: e.title,
          detail: e.detail,
          category: e.category,
          amount: e.amount,
          tags: e.tags,
          recordType: e.recordType,
        })),
        enableSearch,
      }),
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      const isQuota = res.status === 402 || errorData.error === 'GEMINI_QUOTA_DEPLETED'

      if (isQuota) {
        // Fallback to high-quality local analysis
        const fallbackReply = localSmartAnalyze(latestUserPrompt, events)
        return {
          reply: `${fallbackReply}\n\n---\n*⚡（提示：雲端 Gemini API 預付額度維護中，系統已自動啟用 EdenNote 本機深度分析引擎為您即時計算回答。）*`,
          isLocalFallback: true,
        }
      }

      throw new Error(errorData.error || errorData.message || `API 請求失敗: HTTP ${res.status}`)
    }

    const data = await res.json()
    return {
      reply: data.reply || '（無回覆內容）',
      sources: data.sources || [],
      searchQueries: data.searchQueries || [],
      isLocalFallback: false,
    }
  } catch (err: unknown) {
    console.warn('AI request failed, running local smart fallback:', err)
    const fallbackReply = localSmartAnalyze(latestUserPrompt, events)
    return {
      reply: `${fallbackReply}\n\n---\n*⚡（提示：已透過 EdenNote 本機分析引擎為您檢索並計算資料。）*`,
      isLocalFallback: true,
    }
  }
}
