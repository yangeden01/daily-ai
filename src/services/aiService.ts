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
 * Extract meaningful search terms from natural Chinese or English queries.
 */
function extractSearchKeywords(rawPrompt: string): string[] {
  const cleaned = rawPrompt
    .replace(/[？?！!，,。.\n\r#；;:：、\t]/g, ' ')
    .replace(/^(請幫我|幫我|我想查|我想知道|我想看|請問|查詢|搜尋|看一下|找一下|有沒有|有沒有記|統計|分析|整理)/g, '')
    .trim()

  const words: string[] = []
  const parts = cleaned.split(/\s+/).filter(Boolean)

  for (const part of parts) {
    if (part.length >= 2) {
      words.push(part)
    }
    // Also extract 2-character n-grams for compound Chinese phrases like "亞運戰績" -> ["亞運", "戰績"]
    if (part.length >= 4) {
      for (let i = 0; i <= part.length - 2; i += 2) {
        const sub = part.slice(i, i + 2)
        if (!['今天', '昨天', '明天', '什麼', '記錄', '記事', '資料'].includes(sub)) {
          words.push(sub)
        }
      }
    }
  }

  return [...new Set(words)]
}

/**
 * Local analytical engine to handle data queries directly if Gemini quota is unavailable.
 */
export function localSmartAnalyze(prompt: string, events: Event[]): string {
  const p = prompt.trim().toLowerCase()
  const currency = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 })
  const total = events.length

  // A. 外部即時資訊 / 體育賽事 / 新聞 / 天氣 / 股市等外部問題
  const isExternalLiveQuery = /(亞運|奧運|世足|世界盃|中職|棒球|籃球|nba|mlb|賽程|戰績|比分|金牌|獎牌|體育|天氣|氣溫|下雨|降雨|即時新聞|今日新聞|國際新聞|頭條|股價|美股|台股|大盤|匯率|總統大選|熱搜)/i.test(prompt)
  if (isExternalLiveQuery) {
    // 檢查使用者本機紀錄是否有相關關鍵字
    const keywords = extractSearchKeywords(prompt)
    const matchingPersonalNotes = events.filter((e) => {
      const text = `${e.title} ${e.detail} ${e.category} ${e.tags.join(' ')}`.toLowerCase()
      return keywords.some((kw) => text.includes(kw.toLowerCase()))
    }).slice(0, 5)

    let response = `### 🏆 關於「${prompt}」查詢說明\n\n`
    response += `您好！您詢問的是外部即時資訊或賽事新聞（**${prompt}**）。\n\n`

    if (matchingPersonalNotes.length > 0) {
      response += `#### 📝 在您的 EdenNote 個人筆記中找到相關紀錄：\n`
      for (const e of matchingPersonalNotes) {
        response += `- **[${e.date || '無日期'}]**【${e.category}】**${e.title}**\n`
        if (e.detail) response += `  > ${e.detail.slice(0, 80)}\n`
      }
      response += `\n---\n`
    } else {
      response += `- **本機個人資料庫檢索**：\n`
      response += `  經檢索您在 EdenNote 內的 **${total} 筆個人紀錄**，目前尚未包含與「**${keywords.join('、') || prompt}**」相關的個人事件或記事。\n\n`
    }

    response += `- **外部即時聯網說明**：\n`
    response += `  目前系統處於 **EdenNote 本機專屬分析引擎模式**（雲端 Google 聯網搜尋額度暫時維護中）。本機引擎專注於安全離線分析您裝置內的個人生活與工作紀錄，**無法直接連線至外部新聞網站抓取今日最新即時賽況、新聞或比分**。\n\n`
    response += `💡 **建議**：\n`
    response += `1. **查詢即時賽果**：建議開啟手機瀏覽器搜尋「${prompt}」獲取最新體育快訊與即時比分。\n`
    response += `2. **記錄個人心得**：若您想記錄觀賽心得或日常記事，可在底部的 **Input** 頁面隨時新增，我會為您永久妥善整理與調閱！`

    return response
  }

  // B. 問候與功能介紹
  const isGreeting = /^(你好|哈囉|嗨|hi|hello|早安|午安|晚安|你是誰|你的功能|你會做什麼|介紹一下|說明|幫助|help)$/i.test(prompt.replace(/[？?！!]/g, ''))
  if (isGreeting) {
    return `### 👋 您好！我是 EdenNote 專屬智慧分析助理\n\n很高興為您服務！我能深入分析與檢索儲存在您裝置內的 **${total} 筆個人生活紀錄**，協助您：\n\n` +
      `1. 📊 **薪資與加薪成長率**：輸入「分析歷年加薪」，自動計算每次調幅與年化成長率（CAGR）。\n` +
      `2. ⏱️ **工時與加班統計**：輸入「統計加班」，計算總工時與加班發生頻率。\n` +
      `3. 💰 **消費與支出明細**：輸入「統計花費」，匯總各分類開銷佔比與最大筆支出。\n` +
      `4. 🔍 **快速翻找任何記事**：只要輸入人名、關鍵字或日期（例如：「看牙」、「日本旅遊」），即刻為您精確調出！\n` +
      `5. 🎂 **紀念日與倒數**：推算重要節日天數與農民曆對照。\n\n` +
      `您可以直接在下方輸入框鍵入問題開始體驗！`
  }

  // C. 今天、昨天與特定日期檢索
  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (p.includes('今天') || p.includes('今日')) {
    const todayEvents = events.filter((e) => e.date === todayStr)
    if (todayEvents.length > 0) {
      let report = `### 📅 今日紀錄彙整（${todayStr}）\n\n今天您在 EdenNote 共有 **${todayEvents.length} 筆** 紀錄：\n\n`
      for (const e of todayEvents) {
        const amt = e.amount !== undefined ? `（${currency.format(e.amount)}）` : ''
        report += `- 【${e.category}】**${e.title}** ${amt}\n`
        if (e.detail) report += `  > ${e.detail}\n`
      }
      return report
    } else {
      return `### 📅 今日記事（${todayStr}）\n\n您今天尚未記錄任何日常事件或備忘筆記。\n\n💡 隨時點選底部的 **Input** 頁面，即可快速記下今天的所見所聞或待辦事項！`
    }
  }

  if (p.includes('昨天') || p.includes('昨日')) {
    const yestEvents = events.filter((e) => e.date === yesterdayStr)
    if (yestEvents.length > 0) {
      let report = `### 📅 昨日紀錄回顧（${yesterdayStr}）\n\n昨天共有 **${yestEvents.length} 筆** 紀錄：\n\n`
      for (const e of yestEvents) {
        const amt = e.amount !== undefined ? `（${currency.format(e.amount)}）` : ''
        report += `- 【${e.category}】**${e.title}** ${amt}\n`
        if (e.detail) report += `  > ${e.detail}\n`
      }
      return report
    } else {
      return `### 📅 昨日記事（${yesterdayStr}）\n\n您在昨天尚未新增紀錄。`
    }
  }

  // D. 薪資與加薪分析
  if (p.includes('加薪') || p.includes('薪資') || p.includes('薪水') || p.includes('調薪') || p.includes('salary')) {
    const salaryEvents = events
      .filter((e) => {
        const text = `${e.title} ${e.detail} ${e.category} ${e.tags.join(' ')}`.toLowerCase()
        return text.includes('加薪') || text.includes('薪資') || text.includes('薪水') || text.includes('調薪') || text.includes('底薪') || text.includes('月薪')
      })
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))

    if (salaryEvents.length === 0) {
      return `### 📊 EdenNote 薪資與加薪資料分析\n\n目前在您的資料庫中尚未找到包含「薪資」、「加薪」或「調薪」關鍵字的紀錄。\n\n**💡 建議記錄方式：**\n您可以在 **Input** 頁面新增事件，例如：\n- 標題：「**年度考核調薪至 65,000**」\n- 分類：「**工作**」或「**薪資**」\n- 金額：「**65000**」\n- 標籤：「**#加薪 #薪資**」\n\n記錄後隨時詢問我，即可為您自動計算加薪金額、每次調幅與歷年年化成長率（CAGR）！`
    }

    let report = `### 📊 歷年薪資與加薪記錄深入分析\n\n為您檢索到 **${salaryEvents.length} 筆** 與薪資/調薪相關的紀錄：\n\n`
    report += `| 日期 | 事件標題 | 分類 | 標記金額 | 備註說明 |\n`
    report += `| :--- | :--- | :---: | :---: | :--- |\n`

    const amountsWithDates: Array<{ date: string; amount: number; title: string; id: string }> = []

    for (const evt of salaryEvents) {
      const amtStr = evt.amount !== undefined ? currency.format(evt.amount) : '未標記'
      report += `| ${evt.date || '無日期'} | **${evt.title}** | ${evt.category} | ${amtStr} | ${evt.detail?.slice(0, 30) || '無'} |\n`

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
    }

    return report
  }

  // E. 加班與工時分析
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

  // F. 支出與花費統計
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

  // G. 紀念日與生日相關（精確時間範圍推算與每年循環節日比對）
  if (p.includes('紀念日') || p.includes('生日') || p.includes('週年') || p.includes('周年')) {
    const anniEvents = events.filter((e) => e.recordType === 'anniversary' || e.category === '紀念日' || e.category === '生日')

    const now = new Date()
    const currentYear = now.getFullYear()
    const fmtZh = (dt: Date) => `${dt.getMonth() + 1} 月 ${dt.getDate()} 日`
    const toMmDd = (dt: Date) => `${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`

    const getDayMmDd = (e: Event): string => {
      if (!e.date) return ''
      const parts = e.date.split('-')
      if (parts.length >= 3) return `${parts[1]}-${parts[2]}`
      if (parts.length === 2) return `${parts[0]}-${parts[1]}`
      return ''
    }

    // 判斷是否詢問「上週 / 上周」
    if (p.includes('上周') || p.includes('上週') || p.includes('上一週') || p.includes('上一周') || p.includes('上個星期') || p.includes('上星期')) {
      const dayOfWeek = now.getDay() || 7
      const monday = new Date(now)
      monday.setDate(now.getDate() - dayOfWeek + 1)
      const lastMonday = new Date(monday)
      lastMonday.setDate(monday.getDate() - 7)
      const lastSunday = new Date(monday)
      lastSunday.setDate(monday.getDate() - 1)

      // 產生上週所有日期的 MM-DD 列表
      const targetDays: string[] = []
      const cur = new Date(lastMonday)
      while (cur <= lastSunday) {
        targetDays.push(toMmDd(cur))
        cur.setDate(cur.getDate() + 1)
      }

      const matched = anniEvents.filter((e) => targetDays.includes(getDayMmDd(e)))

      if (matched.length > 0) {
        let report = `### 🎂 上週生日與紀念日紀錄（${fmtZh(lastMonday)} 至 ${fmtZh(lastSunday)}）\n\n`
        report += `在您的個人紀錄中，上週共有 **${matched.length} 位** 人員過生日：\n\n`
        for (const e of matched) {
          report += `- **[${e.date || '無日期'}]**【${e.category}】**${e.title}**\n`
          if (e.detail) report += `  > ${e.detail}\n`
        }
        return report
      } else {
        return `在您的個人日曆與紀錄中，上週（${fmtZh(lastMonday)} 至 ${fmtZh(lastSunday)}）並沒有登記任何生日活動或提醒。\n\n如果您是指特定群組、同事圈，或是某些公眾人物／名人的生日，請告訴我是哪方面，我再為您查詢！`
      }
    }

    // 判斷是否詢問「本週 / 這周 / 這星期」
    if (p.includes('這周') || p.includes('這週') || p.includes('本周') || p.includes('本週') || p.includes('這個星期') || p.includes('本星期')) {
      const dayOfWeek = now.getDay() || 7
      const monday = new Date(now)
      monday.setDate(now.getDate() - dayOfWeek + 1)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)

      const targetDays: string[] = []
      const cur = new Date(monday)
      while (cur <= sunday) {
        targetDays.push(toMmDd(cur))
        cur.setDate(cur.getDate() + 1)
      }

      const matched = anniEvents.filter((e) => targetDays.includes(getDayMmDd(e)))
      if (matched.length > 0) {
        let report = `### 🎂 本週生日與紀念日（${fmtZh(monday)} 至 ${fmtZh(sunday)}）\n\n本週共有 **${matched.length} 位** 人員生日：\n\n`
        for (const e of matched) {
          report += `- **[${e.date || '無日期'}]**【${e.category}】**${e.title}**\n`
          if (e.detail) report += `  > ${e.detail}\n`
        }
        return report
      } else {
        return `在您的個人日曆與紀錄中，本週（${fmtZh(monday)} 至 ${fmtZh(sunday)}）沒有登記任何生日或紀念日提醒。`
      }
    }

    // 判斷是否詢問「下週 / 下周」
    if (p.includes('下周') || p.includes('下週') || p.includes('下一週') || p.includes('下星期')) {
      const dayOfWeek = now.getDay() || 7
      const monday = new Date(now)
      monday.setDate(now.getDate() - dayOfWeek + 1 + 7)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)

      const targetDays: string[] = []
      const cur = new Date(monday)
      while (cur <= sunday) {
        targetDays.push(toMmDd(cur))
        cur.setDate(cur.getDate() + 1)
      }

      const matched = anniEvents.filter((e) => targetDays.includes(getDayMmDd(e)))
      if (matched.length > 0) {
        let report = `### 🎂 下週生日與紀念日預告（${fmtZh(monday)} 至 ${fmtZh(sunday)}）\n\n下週共有 **${matched.length} 位** 人員生日：\n\n`
        for (const e of matched) {
          report += `- **[${e.date || '無日期'}]**【${e.category}】**${e.title}**\n`
          if (e.detail) report += `  > ${e.detail}\n`
        }
        return report
      } else {
        return `在您的個人紀錄中，下週（${fmtZh(monday)} 至 ${fmtZh(sunday)}）沒有登記任何生日提醒。`
      }
    }

    // 判斷是否詢問特定人物（例如「陳啟賓」）
    const searchKeywords = extractSearchKeywords(prompt).filter((k) => !['生日', '紀念日', '週年', '那些', '哪些', '誰', '有誰'].includes(k))
    if (searchKeywords.length > 0) {
      const matched = anniEvents.filter((e) => {
        const text = `${e.title} ${e.detail} ${e.category}`.toLowerCase()
        return searchKeywords.some((k) => text.includes(k.toLowerCase()))
      })
      if (matched.length > 0) {
        let report = `### 🎂 生日與紀念日查詢結果\n\n為您找到 **${matched.length} 筆** 與「${searchKeywords.join('、')}」相關的紀錄：\n\n`
        for (const e of matched) {
          report += `- **[${e.date || '無日期'}]**【${e.category}】**${e.title}**\n`
          if (e.detail) report += `  > ${e.detail}\n`
        }
        return report
      }
    }

    // 若無特定時間範圍，預設列出即將到來的紀念日
    if (anniEvents.length > 0) {
      let report = `### 🎂 紀念日與生日總覽（共 ${anniEvents.length} 筆）\n\n`
      for (const e of anniEvents.slice(0, 10)) {
        report += `- **[${e.date || '無日期'}]**【${e.category}】**${e.title}**\n`
        if (e.detail) report += `  > ${e.detail}\n`
      }
      if (anniEvents.length > 10) {
        report += `\n*（其餘 ${anniEvents.length - 10} 筆已保留於資料庫中，可輸入特定姓名或月份進行縮小查詢）*`
      }
      return report
    }
  }

  // H. 一般關鍵字智慧檢索（支援中文子詞、多詞比對）
  const searchKeywords = extractSearchKeywords(prompt)
  if (searchKeywords.length > 0) {
    const matching = events.filter((e) => {
      const text = `${e.title} ${e.detail} ${e.category} ${e.date} ${e.tags.join(' ')}`.toLowerCase()
      return searchKeywords.some((kw) => text.includes(kw.toLowerCase()))
    }).slice(0, 15)

    if (matching.length > 0) {
      let report = `### 🔍 檢索結果\n\n針對您的提問「**${prompt}**」，在您的 EdenNote 資料庫中找到 **${matching.length} 筆** 相關紀錄：\n\n`
      for (const e of matching) {
        const amt = e.amount !== undefined ? `（${currency.format(e.amount)}）` : ''
        report += `- **[${e.date || '無日期'}]**【${e.category}】**${e.title}** ${amt}\n`
        if (e.detail) {
          report += `  > ${e.detail.slice(0, 90)}\n`
        }
      }
      return report
    } else {
      return `### 🔍 檢索說明\n\n您詢問了：「**${prompt}**」。\n\n在您目前的 **${total} 筆 EdenNote 本機紀錄** 中，未找到包含「**${searchKeywords.join('、')}**」的個人筆記。\n\n💡 **貼心建議**：\n1. 您可以嘗試簡化關鍵字或使用同義詞搜尋。\n2. 若這是需要記錄的新生活事件，可隨時在底部的 **Input** 頁面新增，日後即可由 AI 隨時為您分析與調閱！`
    }
  }

  // 預設資料庫統計狀態
  const dailyCount = events.filter((e) => !e.recordType || e.recordType === 'daily').length
  const noteCount = events.filter((e) => e.recordType === 'note').length
  const anniCount = events.filter((e) => e.recordType === 'anniversary').length

  return `### 🤖 EdenNote AI 資料庫分析助理\n\n您詢問了：「**${prompt}**」。\n\n目前 EdenNote 資料庫共有 **${total} 筆紀錄**：\n- 📅 **Daily 日常紀錄**：${dailyCount} 筆\n- 📝 **Notes 備忘記事**：${noteCount} 筆\n- 🎂 **紀念日**：${anniCount} 筆\n\n您可以試著詢問我：\n1. 「**分析歷年加薪紀錄與加薪速率**」\n2. 「**統計工作與加班時數**」\n3. 「**計算累計花費與各分類支出**」\n4. 「**整理今天的重點紀錄**」\n5. 「**搜尋特定關鍵字筆記（例如：看牙、合約、旅遊）**」`
}

/**
 * Resolve the API base URL for different environments (Android APK, GitHub Pages, or Vite Dev).
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return ''

  // 1. User custom server URL in Settings (if set)
  const custom = localStorage.getItem('eden_ai_server_url')
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, '')
  }

  // 2. Running in native Android/iOS APK (Capacitor) or static GitHub Pages
  const isCapacitorNative =
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && window.location.port !== '3000') ||
    window.location.hostname.includes('github.io')

  if (isCapacitorNative) {
    return 'https://ais-dev-vo2jwpza6k6g6j2ucae765-290275720433.asia-northeast1.run.app'
  }

  // 3. Local web development or same-origin server
  return ''
}

/**
 * Health check status of the AI backend server
 */
export async function checkAiServerHealth(): Promise<{
  ok: boolean
  statusText: string
  hasGeminiKey?: boolean
  error?: string
}> {
  try {
    const base = getApiBaseUrl()
    const url = `${base}/api/health`
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) {
      return { ok: false, statusText: `HTTP ${res.status}` }
    }
    const data = await res.json()
    return {
      ok: true,
      statusText: '在線',
      hasGeminiKey: Boolean(data.hasGeminiKey),
    }
  } catch (err) {
    return {
      ok: false,
      statusText: '離線 / 無法連線',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export const DEFAULT_GEMINI_KEY =
  (import.meta as any).env?.VITE_GEMINI_API_KEY || ''

/**
 * Gemini API Key management from user settings or localStorage.
 */
export function getUserGeminiApiKey(): string {
  if (typeof window === 'undefined') return DEFAULT_GEMINI_KEY
  const stored = localStorage.getItem('eden_user_gemini_api_key')
  if (stored !== null && stored !== undefined) {
    return stored
  }
  return DEFAULT_GEMINI_KEY
}

export function setUserGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return
  const trimmed = key.trim()
  if (trimmed) {
    localStorage.setItem('eden_user_gemini_api_key', trimmed)
  } else {
    localStorage.setItem('eden_user_gemini_api_key', '')
  }
}

/**
 * Test a Gemini API Key to verify connectivity and quota.
 */
export async function testGeminiApiKey(apiKey: string): Promise<{ ok: boolean; message: string; isDepleted?: boolean }> {
  const key = apiKey.trim()
  if (!key) {
    return { ok: false, message: '請先輸入 API Key' }
  }

  try {
    // 1. 先檢驗金鑰合法性 (List Models 檢驗認證)
    const checkRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
      method: 'GET',
    })
    if (!checkRes.ok) {
      const err = await checkRes.json().catch(() => ({}))
      return { ok: false, message: `金鑰無效：${err.error?.message || `HTTP ${checkRes.status}`}` }
    }

    // 2. 測試 Gemini 3.8 Flash 生成能力與額度狀態
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: '請只回覆「連線成功」四個字' }] }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err.error?.message || `HTTP ${res.status}`
      if (res.status === 402 || msg.includes('depleted') || msg.includes('RESOURCE_EXHAUSTED')) {
        return {
          ok: true,
          isDepleted: true,
          message: 'Google 驗證成功！此金鑰有效，目前專案尚無預付額度（已啟用本機分析引擎為您解答）。',
        }
      }
      return { ok: false, message: `金鑰驗證失敗: ${msg}` }
    }

    return { ok: true, message: '✨ Gemini 3.8 Flash AI Agent 連線成功！' }
  } catch (err) {
    return {
      ok: false,
      message: `網路連線失敗: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Build rich system prompt with current temporal anchor and EdenNote events.
 */
export function buildGeminiSystemPrompt(events: Event[]): string {
  const now = new Date()
  const twIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const [y, m, d] = twIso.split('-').map(Number)
  const twToday = new Date(y, m - 1, d)
  const dayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const weekday = dayNames[twToday.getDay()]

  const dayOfWeek = twToday.getDay() || 7
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

  const sortedEvents = [...events].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
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
        parts.push(`詳情:${evt.detail.replace(/\r?\n/g, ' ').slice(0, 160)}`)
      }
      return `${idx + 1}. [ID:${evt.id}] ${parts.filter(Boolean).join(' ')}`
    })
    .join('\n')

  return `你是一個專業、親切且嚴謹的個人生活與工作智慧助理，名稱為「EdenNote AI 助理」。
你擁有讀取與深入分析使用者「EdenNote 資料庫」的專屬權限，並且具備強大的即時聯網搜尋與常識推理能力。

【當前時間基準與時間範圍】：
- 今天是：${twIso}（${weekday}）
- 上週區間：約 ${fmtZh(lastMonday)} 至 ${fmtZh(lastSunday)}（${fmtIso(lastMonday)} ~ ${fmtIso(lastSunday)}）
- 本週區間：約 ${fmtZh(monday)} 至 ${fmtZh(sunday)}（${fmtIso(monday)} ~ ${fmtIso(sunday)}）
- 下週區間：約 ${fmtZh(nextMonday)} 至 ${fmtZh(nextSunday)}（${fmtIso(nextMonday)} ~ ${fmtIso(nextSunday)}）
- 當前月份：${y} 年 ${m} 月

【使用者的 EdenNote 本機資料庫現況】
資料庫共有 ${events.length} 筆紀錄：
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
          ⚠️ 絕對不要無差別列出全年度所有名單！
   - 歷年加薪與薪資變動：能搜尋所有薪資、加薪、調薪、工作待遇等紀錄，列出各年份/月份的薪水數字，計算每次加薪金額、每次調薪比例（%）、歷年加薪速率或年化成長率（CAGR），並使用清晰整齊的 Markdown 表格呈現！
   - 加班與工作時數：搜尋加班、工時、專案、請假、值班等關鍵字，統計總加班時數、頻率或工時趨勢。
   - 財務與消費支出：針對含有金額（amount）的紀錄，進行類別加總、月度或年度支出統計、最大筆開銷分析。
   - 重點記事歸納：依據使用者指定的時間段或分類，條理分明地歸納工作心得、生活摘要與待辦進度。

2. 嚴格區分「個人資料查詢」與「外部即時/世界常識問題」：
   - 【個人生活/工作/記事問題】：精確比對資料庫紀錄，標註 [日期]、分類、標題、金額與詳情。
   - 【外部即時/新聞/賽事/通識問題】（例如亞運戰績、天氣、NBA、即時新聞）：請直接使用 Google 搜尋工具或模型通識知識進行直接、正面且完整的回答！切勿生硬套入個人筆記搜尋！
   - 【綜合比對問題】：先計算個人紀錄，再利用 Google 搜尋客觀外部數據比較。

3. 回覆格式要求：
   - 必須使用台灣習慣的「繁體中文」回答。
   - 語氣親切、專業、富有洞察力與對話感（如官方 Gemini App 對話體驗）。
   - 善用 Markdown 排版：小標題、粗體、清單、Markdown 表格。
   - 若引用到特定個人事件，請標示出日期與標題，並標記格式 [事件：標題 (日期)](event:ID)。`
}

/**
 * Directly call Google Gemini REST API from client (useful for mobile APK and direct key users).
 */
export async function directGeminiChat(
  options: SendMessageOptions,
  apiKey: string
): Promise<ChatResponse> {
  const { messages, events, enableSearch = true } = options
  const systemPrompt = buildGeminiSystemPrompt(events)

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const body: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
  }

  if (enableSearch) {
    body.tools = [{ googleSearch: {} }]
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey.trim()}`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const errMsg = err.error?.message || `Gemini API 呼叫失敗: HTTP ${res.status}`
    const isQuota = res.status === 402 || res.status === 429 || errMsg.includes('depleted') || errMsg.includes('RESOURCE_EXHAUSTED')
    const errorObj = new Error(errMsg)
    Object.assign(errorObj, { status: res.status, isQuota })
    throw errorObj
  }

  const data = await res.json()
  const candidate = data.candidates?.[0]
  const reply = candidate?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '（無回覆）'

  const sources: Array<{ title: string; url: string }> = []
  const groundingChunks = candidate?.groundingMetadata?.groundingChunks || []
  for (const chunk of groundingChunks) {
    if (chunk.web?.uri) {
      sources.push({
        title: chunk.web.title || chunk.web.uri,
        url: chunk.web.uri,
      })
    }
  }

  return {
    reply,
    sources,
    isLocalFallback: false,
  }
}

/**
 * Send chat message to EdenNote AI backend with fallback.
 */
export async function sendChatMessage(options: SendMessageOptions): Promise<ChatResponse> {
  const { messages, events, enableSearch = true } = options
  const latestUserPrompt = messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || ''
  const userApiKey = getUserGeminiApiKey()

  // 1. 若使用者有設定自己的 Gemini API Key，優先嘗試直連 Gemini 3.8 Flash AI Agent
  if (userApiKey) {
    try {
      const directResult = await directGeminiChat(options, userApiKey)
      return directResult
    } catch (directErr: unknown) {
      console.warn('Direct Gemini call failed, checking error:', directErr)
      const err = directErr as { status?: number; isQuota?: boolean; message?: string }
      if (err?.status === 402 || err?.isQuota || String(err?.message).includes('depleted')) {
        const fallbackReply = localSmartAnalyze(latestUserPrompt, events)
        const tip = `\n\n---\n*⚡（提示：您提供的 Gemini API Key 已通過 Google 驗證！目前專案尚無預付額度 [402 Depleted]，系統已無縫啟用 EdenNote 深度分析引擎為您解答並精確融合個人紀錄。若需啟用 Google 官方雲端算力，可至 [Google AI Studio](https://ai.studio/projects) 啟用預付點數。）*`
        return {
          reply: `${fallbackReply}${tip}`,
          isLocalFallback: true,
        }
      }
    }
  }

  // 2. 透過後端伺服器代理呼叫
  try {
    const baseUrl = getApiBaseUrl()
    const endpoint = `${baseUrl}/api/ai/chat`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (userApiKey) {
      headers['x-gemini-api-key'] = userApiKey
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
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
        const tip = userApiKey
          ? `\n\n---\n*⚡（提示：您設定的 Gemini API Key 額度已用盡或尚未開通付費專案，系統已啟動 EdenNote 本機深度分析引擎為您解答。）*`
          : `\n\n---\n*⚡（提示：目前預設雲端額度維護中。若想體驗與截圖完全一致的原生「Gemini 3.8 Flash AI Agent」深度對話與即時聯網，您可隨時在「設定」中填入您自己的 Gemini API Key 即可直接啟用！）*`
        return {
          reply: `${fallbackReply}${tip}`,
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
