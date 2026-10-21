import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  Bot,
  Check,
  CircleDollarSign,
  Clock,
  Copy,
  Database,
  ExternalLink,
  Globe,
  KeyRound,
  LoaderCircle,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import type { Event } from '../../models/Event'
import { eventRepository } from '../../repositories'
import { MarkdownMessage } from '../../components/AIChat/MarkdownMessage'
import {
  sendChatMessage,
  testGeminiApiKey,
  parseEdenNoteAction,
  cleanTextForSpeech,
  type ChatMessage,
  type EdenNoteActionPayload,
} from '../../services/aiService'
import { useAI } from '../../contexts/AIContext'

const STORAGE_KEY = 'edennote_ai_chat_history_v1'

export const AIAssistantPage: React.FC = () => {
  const {
    userApiKey,
    setUserApiKey,
    showKeyModal,
    setShowKeyModal,
    enableSearch,
    isLocalMode,
    setIsLocalMode,
  } = useAI()

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
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Voice Assistant & Hands-free Mode State
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false)
  const [voiceCallStatus, setVoiceCallStatus] = useState<
    'idle' | 'listening' | 'processing' | 'speaking' | 'paused' | 'unsupported' | 'error'
  >('idle')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [lastAiReply, setLastAiReply] = useState('')
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [autoTTS, setAutoTTS] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('edennote_ai_tts_enabled')
      return saved !== null ? saved === 'true' : true
    } catch {
      return true
    }
  })
  const [isDictatingInput, setIsDictatingInput] = useState(false)

  // Refs for tracking voice lifecycle without stale closures
  const isVoiceCallOpenRef = useRef(false)
  const voiceCallStatusRef = useRef<'idle' | 'listening' | 'processing' | 'speaking' | 'paused' | 'unsupported' | 'error'>('idle')
  const recognitionRef = useRef<any>(null)
  const silenceTimerRef = useRef<any>(null)

  // Keep refs in sync
  useEffect(() => {
    isVoiceCallOpenRef.current = isVoiceCallOpen
  }, [isVoiceCallOpen])

  useEffect(() => {
    voiceCallStatusRef.current = voiceCallStatus
  }, [voiceCallStatus])

  // User Gemini API Key modal state
  const [keyInput, setKeyInput] = useState(userApiKey)
  const [keyTestState, setKeyTestState] = useState<{ testing?: boolean; ok?: boolean; isDepleted?: boolean; msg?: string }>({})

  useEffect(() => {
    if (showKeyModal) {
      setKeyInput(userApiKey)
      setKeyTestState({})
    }
  }, [showKeyModal, userApiKey])

  const handleSaveModalKey = () => {
    setUserApiKey(keyInput.trim())
    setShowKeyModal(false)
  }

  const handleTestModalKey = async () => {
    setKeyTestState({ testing: true })
    const res = await testGeminiApiKey(keyInput)
    setKeyTestState({ testing: false, ok: res.ok, isDepleted: res.isDepleted, msg: res.message })
    if (res.ok) {
      setUserApiKey(keyInput.trim())
    }
  }

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

  // Cleanup speech synthesis and recognition on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
      }
    }
  }, [])

  // Execute Note Actions (create, update, delete) directly on EdenNote local repository
  const executeNoteAction = async (actionPayload: EdenNoteActionPayload) => {
    try {
      const { action, data } = actionPayload
      const todayIso = new Date().toISOString().slice(0, 10)

      if (action === 'create') {
        const newEvent: Event = {
          id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          date: data.date || todayIso,
          title: data.title || '日常記事',
          detail: data.detail || '',
          category: data.category || '生活',
          amount: typeof data.amount === 'number' ? data.amount : undefined,
          tags: Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : ['語音記事'],
          attachmentIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          recordType: 'daily',
        }
        await eventRepository.add(newEvent)
        const reloaded = await eventRepository.getAll()
        setEvents(reloaded)
        return { success: true, event: newEvent }
      } else if (action === 'update' && data.id) {
        const existing = events.find((e) => e.id === data.id)
        if (existing) {
          const updated: Event = {
            ...existing,
            title: data.title ?? existing.title,
            detail: data.detail ?? existing.detail,
            category: data.category ?? existing.category,
            date: data.date ?? existing.date,
            amount: data.amount !== undefined ? data.amount : existing.amount,
            tags: Array.isArray(data.tags) ? data.tags : existing.tags,
            updatedAt: new Date().toISOString(),
          }
          await eventRepository.update(data.id, updated)
          const reloaded = await eventRepository.getAll()
          setEvents(reloaded)
          return { success: true, event: updated }
        }
      } else if (action === 'delete') {
        let targetId = data.id
        if (!targetId && data.title) {
          const found = events.find((e) => e.title.includes(data.title!))
          if (found) targetId = found.id
        }
        if (targetId) {
          await eventRepository.delete(targetId)
          const reloaded = await eventRepository.getAll()
          setEvents(reloaded)
          return { success: true, deletedId: targetId }
        }
      }
    } catch (err) {
      console.error('Failed to execute note action:', err)
    }
    return { success: false }
  }

  // TTS speech helper
  const speakVoiceReply = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.()
      return
    }
    try {
      window.speechSynthesis.cancel()
      const spokenText = cleanTextForSpeech(text)
      if (!spokenText) {
        onEnd?.()
        return
      }

      setVoiceCallStatus('speaking')
      const utterance = new SpeechSynthesisUtterance(spokenText)
      utterance.lang = 'zh-TW'
      utterance.rate = 1.05
      utterance.pitch = 1.0

      const voices = window.speechSynthesis.getVoices()
      const zhVoice = voices.find((v) => v.lang.includes('zh-TW') || v.lang.includes('zh-HK') || v.lang.includes('zh'))
      if (zhVoice) utterance.voice = zhVoice

      utterance.onend = () => {
        onEnd?.()
      }
      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e)
        onEnd?.()
      }

      window.speechSynthesis.speak(utterance)
    } catch (err) {
      console.warn('TTS speak error:', err)
      onEnd?.()
    }
  }, [])

  // Toggle TTS setting
  const toggleTTS = () => {
    setAutoTTS((prev) => {
      const next = !prev
      try {
        localStorage.setItem('edennote_ai_tts_enabled', String(next))
      } catch {}
      if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      return next
    })
  }

  // Request microphone permission via WebRTC getUserMedia which explicitly triggers Android system dialog
  const requestMicrophonePermission = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
        setVoiceError(null)
        startVoiceCallListening()
        return true
      }
    } catch (err: any) {
      console.warn('getUserMedia error:', err)
      setVoiceError('麥克風權限尚未開啟。請長按 EdenNote 圖示進入「應用程式資訊」>「權限」設定為「使用中允許」。')
      setVoiceCallStatus('error')
    }
    return false
  }

  // Stop current recognition
  const stopVoiceRecognition = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }
  }

  // Continuous Voice Call: Start listening
  const startVoiceCallListening = () => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionClass) {
      setVoiceCallStatus('unsupported')
      setVoiceError('此裝置或瀏覽器不支援語音辨識 API，建議使用 Chrome 或最新 Android Webview。')
      return
    }

    stopVoiceRecognition()
    setVoiceCallStatus('listening')
    setLiveTranscript('')
    setVoiceError(null)

    try {
      const recognition = new SpeechRecognitionClass()
      recognitionRef.current = recognition
      recognition.lang = 'zh-TW'
      recognition.continuous = false
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      let finalCaptured = ''

      recognition.onstart = () => {
        setVoiceCallStatus('listening')
      }

      recognition.onresult = (e: any) => {
        let currentText = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const item = e.results[i]
          if (item[0]?.transcript) {
            currentText += item[0].transcript
          }
          if (item.isFinal) {
            finalCaptured = currentText
          }
        }
        setLiveTranscript(currentText || finalCaptured)

        // Reset silence timer on every speech event: 1.3s of silence triggers sending
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
        }
        silenceTimerRef.current = setTimeout(() => {
          if (currentText.trim()) {
            stopVoiceRecognition()
            void processVoiceUtterance(currentText.trim())
          }
        }, 1300)
      }

      recognition.onerror = (e: any) => {
        console.warn('SpeechRecognition error:', e.error)
        if (e.error === 'not-allowed') {
          setVoiceError('尚未取得麥克風授權。請點擊下方按鈕，或至手機設定允許 EdenNote 使用麥克風。')
          setVoiceCallStatus('error')
        } else if (e.error === 'no-speech') {
          if (isVoiceCallOpenRef.current && voiceCallStatusRef.current !== 'speaking' && voiceCallStatusRef.current !== 'processing') {
            setTimeout(() => {
              if (isVoiceCallOpenRef.current && voiceCallStatusRef.current !== 'speaking') {
                startVoiceCallListening()
              }
            }, 300)
          }
        }
      }

      recognition.onend = () => {
        if (finalCaptured.trim()) {
          void processVoiceUtterance(finalCaptured.trim())
        } else if (isVoiceCallOpenRef.current && voiceCallStatusRef.current === 'listening') {
          setTimeout(() => {
            if (isVoiceCallOpenRef.current && voiceCallStatusRef.current === 'listening') {
              startVoiceCallListening()
            }
          }, 350)
        }
      }

      recognition.start()
    } catch (err) {
      console.warn('Failed to start speech recognition:', err)
      setVoiceCallStatus('error')
    }
  }

  // Handle spoken utterance in hands-free voice mode
  const processVoiceUtterance = async (spokenText: string) => {
    if (!spokenText.trim()) return
    setVoiceCallStatus('processing')
    setLiveTranscript(spokenText)

    // Check for exit / farewell commands
    if (/^(再見|掰掰|拜拜|退出|結束|停止|休息吧|關閉)/.test(spokenText.trim())) {
      const farewell = '好的！隨時為您服務，祝您有美好的一天！'
      setLastAiReply(farewell)
      speakVoiceReply(farewell, () => {
        closeVoiceCall()
      })
      return
    }

    // Submit to AI
    await handleSend(spokenText, true)
  }

  // Open hands-free voice secretary overlay
  const openVoiceCall = () => {
    setIsVoiceCallOpen(true)
    isVoiceCallOpenRef.current = true
    setLiveTranscript('')
    const greeting = '您好！我是您的生活秘書，請直接說話，我正在聽。'
    setLastAiReply(greeting)
    speakVoiceReply(greeting, () => {
      if (isVoiceCallOpenRef.current) {
        startVoiceCallListening()
      }
    })
  }

  // Close hands-free voice secretary overlay
  const closeVoiceCall = () => {
    isVoiceCallOpenRef.current = false
    setIsVoiceCallOpen(false)
    setVoiceCallStatus('idle')
    setLiveTranscript('')
    stopVoiceRecognition()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  // Quick dictation for bottom input textarea
  const handleDictateClick = () => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionClass) {
      alert('您的瀏覽器不支援語音辨識功能。')
      return
    }

    if (isDictatingInput) {
      stopVoiceRecognition()
      setIsDictatingInput(false)
      return
    }

    try {
      const rec = new SpeechRecognitionClass()
      recognitionRef.current = rec
      rec.lang = 'zh-TW'
      rec.continuous = false
      rec.interimResults = true

      setIsDictatingInput(true)

      rec.onresult = (e: any) => {
        let text = ''
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript
        }
        setInput(text)
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
        }
      }

      rec.onerror = () => {
        setIsDictatingInput(false)
      }

      rec.onend = () => {
        setIsDictatingInput(false)
      }

      rec.start()
    } catch (err) {
      console.warn('Dictation failed:', err)
      setIsDictatingInput(false)
    }
  }

  // Send message
  const handleSend = async (customPrompt?: string, isFromVoiceCall = false) => {
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

      // Execute Note Action if present in reply
      const { action, cleanContent } = parseEdenNoteAction(response.reply)
      if (action) {
        await executeNoteAction(action)
      }

      const finalReply = cleanContent || response.reply

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: finalReply,
        timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        sources: response.sources,
        isLocalFallback: response.isLocalFallback,
      }

      setMessages((prev) => [...prev, assistantMessage])
      setLastAiReply(finalReply)

      // Audio response feedback
      if (isFromVoiceCall || (autoTTS && isVoiceCallOpenRef.current)) {
        speakVoiceReply(finalReply, () => {
          // Automatic hands-free re-listen loop!
          if (isVoiceCallOpenRef.current) {
            setTimeout(() => {
              if (isVoiceCallOpenRef.current) {
                startVoiceCallListening()
              }
            }, 350)
          }
        })
      } else if (autoTTS && !isFromVoiceCall) {
        speakVoiceReply(finalReply)
      }
    } catch (err: unknown) {
      const error = err as Error
      const errMsg = `⚠️ 回覆時發生問題：${error?.message || '未知錯誤'}。請重新提問或稍後再試。`
      const errorMessage: ChatMessage = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: errMsg,
        timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMessage])
      setLastAiReply(errMsg)

      if (isFromVoiceCall) {
        speakVoiceReply(errMsg, () => {
          if (isVoiceCallOpenRef.current) {
            setTimeout(() => {
              if (isVoiceCallOpenRef.current) startVoiceCallListening()
            }, 400)
          }
        })
      }
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
      {/* Top Bar: Database status, Voice TTS toggle, and Clear button */}
      <section className="sticky top-14 z-10 flex items-center justify-between gap-2 rounded-2xl border border-stone-200/90 bg-white/95 px-3 py-2 sm:px-3.5 sm:py-2.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-stone-900/95">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-700 dark:text-stone-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          </span>
          <span className="flex items-center gap-1">
            <Database size={13} className="text-indigo-600 dark:text-indigo-400" />
            <span className="hidden xs:inline">EdenNote 資料庫：</span>
            {loadingEvents ? (
              <span className="text-stone-400">載入中…</span>
            ) : (
              <strong className="text-indigo-600 dark:text-indigo-300">{events.length} 筆</strong>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* TTS Audio toggle */}
          <button
            type="button"
            onClick={toggleTTS}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition ${
              autoTTS
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                : 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500'
            }`}
            title={autoTTS ? '已開啟語音自動朗讀' : '已關閉語音朗讀'}
          >
            {autoTTS ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span className="hidden xs:inline">{autoTTS ? '朗讀開' : '朗讀關'}</span>
          </button>

          {/* Clear chat history button */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:border-white/10 dark:bg-stone-800 dark:text-stone-300 transition"
              title="清空對話"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">清空</span>
            </button>
          )}
        </div>
      </section>

      {/* Prominent Hands-free Voice Call Banner */}
      <section className="mt-3">
        <button
          type="button"
          onClick={openVoiceCall}
          className="group relative flex w-full items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-3.5 text-left text-white shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.01] hover:shadow-xl active:scale-95"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md transition group-hover:scale-110">
              <PhoneCall size={22} className="animate-pulse text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-sm tracking-tight sm:text-base">
                <span>🎙️ 開啟免持連續語音對話</span>
                <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  免碰手機
                </span>
              </div>
              <p className="mt-0.5 text-xs text-white/80">
                開車、做家事全程動嘴問、用耳聽，自動查詢與增減記事
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-xs font-semibold text-white/90">
            <span>開始通話</span>
            <span>&rarr;</span>
          </div>
        </button>
      </section>

      {/* Messages area */}
      <div className="flex-1 space-y-4 py-4 pb-12">
        {messages.length === 0 ? (
          /* Empty / Welcome State */
          <div className="my-auto flex flex-col items-center justify-center py-6 text-center">
            <div className="relative mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white shadow-lg shadow-indigo-500/25">
              <Sparkles size={32} />
            </div>

            <h2 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl dark:text-white">
              EdenNote AI 助理
            </h2>
            <p className="mt-2 max-w-md text-xs sm:text-sm leading-relaxed text-stone-500 dark:text-stone-400">
              我是專屬於您的 EdenNote 智慧生活秘書，能深入閱讀並分析您儲存在本裝置內的個人生活紀錄，並支援全程語音查詢與增減記事！
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

            {/* Quick Prompts */}
            <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-md">
              <button
                type="button"
                onClick={() => void handleSend('今天有哪些記事？')}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 shadow-sm transition hover:bg-stone-50 hover:border-indigo-300 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300"
              >
                📅 今天有哪些記事？
              </button>
              <button
                type="button"
                onClick={() => void handleSend('幫我分析歷年加薪')}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 shadow-sm transition hover:bg-stone-50 hover:border-indigo-300 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300"
              >
                📈 分析歷年加薪
              </button>
              <button
                type="button"
                onClick={() => void handleSend('幫我記一下明天上午十點看牙醫')}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 shadow-sm transition hover:bg-stone-50 hover:border-indigo-300 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300"
              >
                📝 幫我記明天看牙醫
              </button>
              <button
                type="button"
                onClick={() => void handleSend('統計加班紀錄')}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 shadow-sm transition hover:bg-stone-50 hover:border-indigo-300 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300"
              >
                ⏱️ 統計加班紀錄
              </button>
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

                      {/* Action buttons (Copy, Read aloud) */}
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-stone-400">
                        <div className="flex items-center gap-2">
                          <span>{message.timestamp}</span>
                          {message.isLocalFallback ? (
                            <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 dark:bg-white/10 dark:text-stone-300">
                              ⚡ 本機引擎
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                              ✨ Gemini AI
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => speakVoiceReply(message.content)}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                            title="語音朗讀回覆"
                          >
                            <Volume2 size={12} />
                            <span>朗讀</span>
                          </button>
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
              <span>EdenNote AI 正在檢索資料庫並思考處理中…</span>
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
          <div className="relative flex items-end gap-1.5 sm:gap-2 rounded-3xl border-2 border-indigo-400/90 bg-white/95 p-1.5 sm:p-2 shadow-2xl shadow-indigo-950/15 backdrop-blur-md transition-all focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-500/20 dark:border-indigo-500/80 dark:bg-stone-900/95 dark:shadow-black/40">
            {/* Quick Microphone Button for Text Input */}
            <button
              type="button"
              onClick={handleDictateClick}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition active:scale-95 ${
                isDictatingInput
                  ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700'
              }`}
              title={isDictatingInput ? '正在聆聽語音... 點擊結束' : '語音口述打字'}
            >
              {isDictatingInput ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              disabled={isSending}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
              }}
              onKeyDown={handleKeyDown}
              placeholder={isDictatingInput ? '正在聆聽您的口述...' : '問問EdenNote AI，或吩咐記下一筆...'}
              className="flex-1 max-h-32 resize-none bg-transparent px-2.5 py-2 text-sm leading-relaxed text-stone-900 placeholder:text-stone-400 focus:outline-none dark:text-white dark:placeholder:text-stone-500"
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

      {/* ========================================================================= */}
      {/* IMMERSIVE HANDS-FREE VOICE CALL OVERLAY (免動手連續語音生活秘書全螢幕介面) */}
      {/* ========================================================================= */}
      {isVoiceCallOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-between bg-stone-950/95 p-6 text-white backdrop-blur-2xl animate-in fade-in duration-300">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md shadow-indigo-500/30">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base tracking-tight">EdenNote 生活秘書</h3>
                <p className="text-[11px] text-stone-400">連續語音對話中 • 全程免碰手機</p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeVoiceCall}
              className="rounded-full bg-white/10 p-2 text-stone-300 transition hover:bg-white/20 active:scale-90"
              title="關閉語音對話"
            >
              <X size={20} />
            </button>
          </div>

          {/* Center Visual: The Animated Audio Orb & Status */}
          <div className="my-auto flex flex-col items-center justify-center text-center">
            {/* Status Pill */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold backdrop-blur-md">
              {voiceCallStatus === 'listening' && (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-400">正在聆聽中… 請直接開口說話</span>
                </>
              )}
              {voiceCallStatus === 'processing' && (
                <>
                  <LoaderCircle size={14} className="animate-spin text-purple-400" />
                  <span className="text-purple-300">正在思考並檢索 EdenNote 資料庫…</span>
                </>
              )}
              {voiceCallStatus === 'speaking' && (
                <>
                  <Volume2 size={14} className="animate-bounce text-pink-400" />
                  <span className="text-pink-300">生活秘書正在用語音回答您…</span>
                </>
              )}
              {voiceCallStatus === 'paused' && <span className="text-amber-300">已暫停聆聽</span>}
              {voiceCallStatus === 'error' && <span className="text-rose-400">麥克風連線異常</span>}
              {voiceCallStatus === 'unsupported' && <span className="text-rose-400">不支援語音辨識</span>}
            </div>

            {/* Glowing Radial Audio Orb */}
            <div className="relative flex items-center justify-center">
              {/* Outer Glow Ring */}
              <div
                className={`absolute h-48 w-48 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 blur-2xl opacity-40 transition-all duration-700 ${
                  voiceCallStatus === 'listening'
                    ? 'scale-125 opacity-70 animate-pulse'
                    : voiceCallStatus === 'speaking'
                    ? 'scale-110 opacity-60 animate-pulse'
                    : 'scale-90 opacity-30'
                }`}
              />

              {/* Main Glowing Circle */}
              <div
                className={`relative flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-2xl shadow-purple-600/50 transition-all duration-500 ${
                  voiceCallStatus === 'listening'
                    ? 'scale-105 shadow-emerald-500/40'
                    : voiceCallStatus === 'speaking'
                    ? 'scale-105 shadow-pink-500/40'
                    : 'scale-95'
                }`}
              >
                {voiceCallStatus === 'listening' ? (
                  <Mic size={48} className="animate-pulse text-white" />
                ) : voiceCallStatus === 'speaking' ? (
                  <Volume2 size={48} className="animate-pulse text-white" />
                ) : (
                  <Sparkles size={48} className="text-white" />
                )}
              </div>
            </div>

            {/* Realtime Live Speech Subtitle */}
            <div className="mt-8 max-w-md px-4">
              {liveTranscript ? (
                <p className="text-base sm:text-lg font-medium text-white/95 leading-relaxed">
                  “{liveTranscript}”
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
                  您可以說：
                  <br />
                  <span className="font-semibold text-stone-300">「幫我查上週看醫生的費用」</span>、
                  <span className="font-semibold text-stone-300">「幫我記明天下午看牙醫」</span>、
                  <span className="font-semibold text-stone-300">「查加薪紀錄」</span>
                </p>
              )}

              {/* Last Spoken AI Reply Snippet */}
              {lastAiReply && !liveTranscript && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-stone-300 text-left">
                  <p className="font-bold text-indigo-300 mb-1">🤖 秘書回覆：</p>
                  <p className="line-clamp-3 leading-relaxed">{lastAiReply}</p>
                </div>
              )}

              {voiceError && (
                <div className="mt-4 rounded-2xl bg-rose-950/80 border border-rose-800/80 p-3.5 text-xs text-rose-200 text-left space-y-2.5 shadow-lg backdrop-blur-md">
                  <div className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold shrink-0">⚠️ 權限提示：</span>
                    <p className="leading-relaxed">{voiceError}</p>
                  </div>
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => void requestMicrophonePermission()}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-md active:scale-95 transition"
                    >
                      <Mic size={15} />
                      <span>點此呼叫 Android 麥克風授權視窗</span>
                    </button>
                  </div>
                  <div className="rounded-xl bg-black/40 p-2.5 text-[11px] text-stone-300 space-y-1">
                    <p className="font-semibold text-white">📱 若系統未彈出視窗，請手動開啟：</p>
                    <p>1. 回到手機桌面，長按「EdenNote」圖示</p>
                    <p>2. 點擊「應用程式資訊」（或 ℹ️ 圖示）</p>
                    <p>3. 點擊「權限」➜ 找到「麥克風」</p>
                    <p>4. 勾選「使用應用程式時允許」即可！</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Call Controls */}
          <div className="mx-auto flex w-full max-w-sm items-center justify-around pb-6">
            {/* Pause / Resume Mic button */}
            <button
              type="button"
              onClick={() => {
                if (voiceCallStatus === 'listening') {
                  stopVoiceRecognition()
                  setVoiceCallStatus('paused')
                } else if (voiceCallStatus === 'paused') {
                  startVoiceCallListening()
                }
              }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
              title={voiceCallStatus === 'listening' ? '暫停聆聽' : '繼續聆聽'}
            >
              {voiceCallStatus === 'listening' ? <MicOff size={24} /> : <Mic size={24} />}
            </button>

            {/* End Call Button */}
            <button
              type="button"
              onClick={closeVoiceCall}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white shadow-xl shadow-rose-600/40 transition hover:bg-rose-700 active:scale-95"
              title="結束語音對話"
            >
              <PhoneOff size={28} />
            </button>

            {/* Say Farewell button */}
            <button
              type="button"
              onClick={() => {
                const farewell = '好的！隨時為您服務，祝您有美好的一天！'
                setLastAiReply(farewell)
                speakVoiceReply(farewell, () => {
                  closeVoiceCall()
                })
              }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95 text-xs font-bold"
              title="說聲再見並退出"
            >
              說再見
            </button>
          </div>
        </div>
      )}

      {/* Gemini API Key Configuration Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    Google Gemini 3.8 Flash AI Agent
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    專屬金鑰直連 Google 官方 AI，享受原生對話與資料融合
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                設定您自己的 Gemini API Key 後，手機 APK 與網頁版將可直接獲得如 Google 官方 Gemini App 的強大智慧推理、聯網搜尋與 EdenNote 資料庫深度融合！
              </p>

              <div>
                <label htmlFor="modal-key-input" className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Gemini API Key
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="modal-key-input"
                    type="password"
                    autoComplete="off"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="貼上 AQ... 或 AIzaSy... 開頭的金鑰"
                    className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-mono text-stone-800 focus:border-indigo-500 focus:bg-white dark:focus:bg-stone-800 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
                  />
                  <button
                    type="button"
                    onClick={() => void handleTestModalKey()}
                    disabled={keyTestState.testing || !keyInput.trim()}
                    className="inline-flex items-center gap-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
                  >
                    {keyTestState.testing ? (
                      <LoaderCircle size={13} className="animate-spin text-amber-600" />
                    ) : (
                      <span>驗證</span>
                    )}
                  </button>
                </div>

                {keyTestState.msg && (
                  <p
                    className={`mt-1.5 text-xs font-medium ${
                      keyTestState.ok
                        ? keyTestState.isDepleted
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-500 dark:text-red-400'
                    }`}
                  >
                    {keyTestState.ok ? (keyTestState.isDepleted ? '🟡 ' : '🟢 ') : '⚠️ '}
                    {keyTestState.msg}
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-stone-50 p-2.5 text-[11px] text-stone-500 dark:bg-stone-800/60 dark:text-stone-400">
                <div className="flex items-center justify-between">
                  <span>還沒有金鑰？可至 Google 免費申請：</span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    <span>獲取 API Key</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setKeyInput('')
                  setUserApiKey('')
                  setShowKeyModal(false)
                }}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                清除金鑰
              </button>
              <button
                type="button"
                onClick={handleSaveModalKey}
                className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-95"
              >
                儲存並啟用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
