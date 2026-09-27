import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  Bot,
  Check,
  Copy,
  Globe,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Clock,
  CircleDollarSign,
  BarChart2,
  Database,
  ExternalLink,
} from 'lucide-react'
import type { Event } from '../../models/Event'
import { eventRepository } from '../../repositories'
import { MarkdownMessage } from '../../components/AIChat/MarkdownMessage'
import { sendChatMessage, type ChatMessage } from '../../services/aiService'

interface Props {
  onSwitchToClassicStats?: () => void
}

const STORAGE_KEY = 'edennote_ai_chat_history_v1'

const quickSuggestions = [
  { label: '📊 歷年加薪與成長率', prompt: '請幫我讀取歷年加薪資料，列出每次調薪記錄，並計算整體成長幅度與年化加薪速率（CAGR）。' },
  { label: '⏱️ 加班與工時統計', prompt: '請統計我所有工作與加班紀錄，計算總加班時數與發生頻率。' },
  { label: '💰 累積花費與各類支出', prompt: '請統計我資料庫中所有有金額的紀錄，列出各類別花費與最大筆的支出。' },
  { label: '📅 整理今日重點記事', prompt: '請整理我今天的重點工作日誌與生活事件，歸納出目前的重點方向。' },
  { label: '🔍 檢索特定關鍵字筆記', prompt: '請幫我檢索資料庫中與健康或看診相關的記事紀錄。' },
]

export const AIAssistantPage: React.FC<Props> = ({ onSwitchToClassicStats }) => {
  const [events, setEvents] = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {
      // ignore
    }
    return []
  })
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [enableSearch, setEnableSearch] = useState(true)
  const [isLocalMode, setIsLocalMode] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load all events from local database
  useEffect(() => {
    eventRepository
      .getAll()
      .then((loaded) => {
        setEvents(loaded)
      })
      .catch((err) => {
        console.error('Failed to load events for AI:', err)
      })
      .finally(() => {
        setLoadingEvents(false)
      })
  }, [])

  // Persist messages in session storage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {
      // ignore
    }
  }, [messages])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || input).trim()
    if (!textToSend || isSending) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setIsSending(true)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const historyPayload = nextMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const response = await sendChatMessage({
        messages: historyPayload,
        events,
        enableSearch,
      })

      if (response.isLocalFallback) {
        setIsLocalMode(true)
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        sources: response.sources,
        isLocalFallback: response.isLocalFallback,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err: unknown) {
      const error = err as Error
      const errorMessage: ChatMessage = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ 回覆時發生問題：${error?.message || '未知錯誤'}。您可以點選下方快捷建議，或重新提問。`,
        timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleClear = () => {
    if (messages.length === 0) return
    if (window.confirm('確定要清空目前的對話紀錄嗎？')) {
      setMessages([])
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-135px)] pb-36 sm:pb-40">
      {/* Top Bar: Database status, Search toggle, Classic stats */}
      <section className="sticky top-14 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200/90 bg-white/95 px-3.5 py-2.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-stone-900/95">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-700 dark:text-stone-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          </span>
          <span className="flex items-center gap-1">
            <Database size={13} className="text-indigo-600 dark:text-indigo-400" />
            <span>EdenNote 資料庫：</span>
            {loadingEvents ? (
              <span className="text-stone-400">載入中…</span>
            ) : (
              <strong className="text-indigo-600 dark:text-indigo-300">{events.length} 筆</strong>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Engine Mode or Google Search grounding toggle */}
          {isLocalMode ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/60 dark:text-amber-300"
              title="目前由 EdenNote 本機深度分析引擎提供離線私密運算"
            >
              <Database size={12} />
              <span>本機分析引擎</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setEnableSearch((prev) => !prev)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                enableSearch
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-stone-100 text-stone-400 border border-transparent dark:bg-stone-800 dark:text-stone-500'
              }`}
              title={enableSearch ? '已開啟 Google 聯網比對' : '已關閉 Google 聯網比對'}
            >
              <Globe size={12} />
              <span>{enableSearch ? 'Google 聯網開' : '聯網關'}</span>
            </button>
          )}

          {/* Clear button */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:border-white/10 dark:bg-stone-800 dark:text-stone-300"
              title="清空對話"
            >
              <RotateCcw size={12} />
              <span>清空</span>
            </button>
          )}

          {/* Switch to classic stats */}
          {onSwitchToClassicStats && (
            <button
              type="button"
              onClick={onSwitchToClassicStats}
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-100 dark:border-white/10 dark:bg-stone-800 dark:text-stone-300"
              title="查看傳統統計圖表"
            >
              <BarChart2 size={12} />
              <span>傳統統計</span>
            </button>
          )}
        </div>
      </section>

      {/* Messages area */}
      <div className="flex-1 space-y-4 py-4 pb-12">
        {messages.length === 0 ? (
          /* Empty / Welcome State like ChatGPT */
          <div className="my-auto flex flex-col items-center justify-center py-6 text-center">
            <div className="relative mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white shadow-lg shadow-indigo-500/25">
              <Sparkles size={32} />
            </div>

            <h2 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl dark:text-white">
              EdenNote AI 助理
            </h2>
            <p className="mt-2 max-w-md text-xs sm:text-sm leading-relaxed text-stone-500 dark:text-stone-400">
              我是專屬於您的 EdenNote 智慧分析助理，能深入閱讀並分析您儲存在本裝置內的個人生活紀錄（薪資調幅、工時加班、記事備忘、消費與紀念日）！
            </p>

            {/* Quick feature badges */}
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-stone-600 dark:text-stone-300">
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                <TrendingUp size={13} /> 薪資與加薪速率
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1 font-medium text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                <Clock size={13} /> 工時與加班統計
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CircleDollarSign size={13} /> 財務與消費彙整
              </span>
            </div>

            {/* Quick suggestion prompt cards */}
            <div className="mt-6 w-full max-w-lg space-y-2 text-left">
              <p className="px-1 text-xs font-bold text-stone-400 uppercase tracking-wider">
                💡 快速提問建議（點選即可送出）
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {quickSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => void handleSend(item.prompt)}
                    className="flex flex-col rounded-2xl border border-stone-200 bg-white p-3 text-left shadow-sm transition hover:border-indigo-400 hover:bg-indigo-50/40 active:scale-[0.99] dark:border-white/10 dark:bg-stone-900 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/30"
                  >
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {item.label}
                    </span>
                    <span className="mt-1 line-clamp-2 text-[11px] leading-4 text-stone-500 dark:text-stone-400">
                      {item.prompt}
                    </span>
                  </button>
                ))}
              </div>

              {/* Direct jump to input tip */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => textareaRef.current?.focus()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 active:scale-95 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/80"
                >
                  <span>💬 或直接在下方輸入框鍵入問題</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Conversation message thread */
          messages.map((message) => {
            const isUser = message.role === 'user'
            return (
              <div
                key={message.id}
                className={`flex gap-2.5 sm:gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-sm">
                    <Bot size={18} />
                  </div>
                )}

                <div
                  className={`relative max-w-[88%] sm:max-w-[82%] rounded-3xl px-4 py-3 sm:px-5 sm:py-3.5 shadow-sm ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'border border-stone-200/90 bg-white text-stone-900 rounded-tl-sm dark:border-white/10 dark:bg-stone-900 dark:text-white'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  ) : (
                    <div>
                      <MarkdownMessage content={message.content} />

                      {/* Web search sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3.5 border-t border-stone-100 pt-2.5 dark:border-white/10">
                          <p className="flex items-center gap-1 text-[11px] font-bold text-stone-400">
                            <Globe size={12} />
                            <span>聯網參考來源：</span>
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {message.sources.map((src, sIdx) => (
                              <a
                                key={sIdx}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-700 transition hover:bg-indigo-50 hover:text-indigo-600 dark:bg-white/10 dark:text-stone-300 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-300"
                                title={src.title}
                              >
                                <span className="truncate">{src.title}</span>
                                <ExternalLink size={10} className="shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action buttons (Copy) */}
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-stone-400">
                        <div className="flex items-center gap-2">
                          <span>{message.timestamp}</span>
                          {message.isLocalFallback && (
                            <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 dark:bg-white/10 dark:text-stone-300">
                              ⚡ 本機分析
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(message.content, message.id)}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                          title="複製內容"
                        >
                          {copiedId === message.id ? (
                            <>
                              <Check size={12} className="text-emerald-500" />
                              <span className="text-emerald-500">已複製</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>複製</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-2xl bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200 font-bold text-xs shadow-sm">
                    您
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Loading Indicator */}
        {isSending && (
          <div className="flex justify-start gap-2.5 sm:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-sm">
              <Sparkles size={18} className="animate-spin" />
            </div>
            <div className="flex items-center gap-2 rounded-3xl rounded-tl-sm border border-stone-200/90 bg-white px-4 py-3 text-xs sm:text-sm font-medium text-stone-600 shadow-sm dark:border-white/10 dark:bg-stone-900 dark:text-stone-300">
              <LoaderCircle size={16} className="animate-spin text-indigo-600 dark:text-indigo-400" />
              <span>EdenNote AI 正在檢索資料庫並思考計算中…</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Bottom Composer */}
      <div
        className="fixed left-0 right-0 z-30 mx-auto max-w-2xl px-3 sm:px-8 pointer-events-none"
        style={{ bottom: 'calc(var(--app-bottom-margin, 1.75rem) + 4.75rem)' }}
      >
        <div className="pointer-events-auto">
          {/* Suggestion prompt chips if has messages */}
          {messages.length > 0 && (
            <div className="mb-2 flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
              {quickSuggestions.slice(0, 3).map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isSending}
                  onClick={() => void handleSend(s.prompt)}
                  className="shrink-0 rounded-full border border-stone-200/90 bg-white/95 px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm backdrop-blur transition hover:border-indigo-300 hover:text-indigo-600 active:scale-95 disabled:opacity-50 dark:border-white/10 dark:bg-stone-900/95 dark:text-stone-300"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div className="relative flex items-end gap-2 rounded-3xl border-2 border-indigo-400/90 bg-white/95 p-1.5 sm:p-2 shadow-2xl shadow-indigo-950/15 backdrop-blur-md transition-all focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-500/20 dark:border-indigo-500/80 dark:bg-stone-900/95 dark:shadow-black/40">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              disabled={isSending}
              onChange={(e) => {
                setInput(e.target.value)
                // Auto-expand textarea
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
              }}
              onKeyDown={handleKeyDown}
              placeholder="詢問 EdenNote 資料庫（例如：分析加薪、加班統計…）"
              className="flex-1 max-h-32 resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-stone-900 placeholder:text-stone-400 focus:outline-none dark:text-white dark:placeholder:text-stone-500"
            />

            <button
              type="button"
              disabled={!input.trim() || isSending}
              onClick={() => void handleSend()}
              aria-label="送出"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow transition hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-stone-800 dark:disabled:text-stone-600"
            >
              {isSending ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <ArrowUp size={20} strokeWidth={2.4} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
