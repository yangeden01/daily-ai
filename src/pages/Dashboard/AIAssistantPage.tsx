import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  AudioLines,
  Bot,
  Check,
  ChevronRight,
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
  NotebookPen,
  PhoneCall,
  PhoneOff,
  Plus,
  RotateCcw,
  Search,
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
  chunkSpeechText,
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
    setEnableSearch,
    isLocalMode,
    setIsLocalMode,
    activeTab,
    setActiveTab,
    newChatTrigger,
  } = useAI()

  const [showPlusMenu, setShowPlusMenu] = useState(false)

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
  const isRecognizingRef = useRef(false)
  const silenceTimerRef = useRef<any>(null)
  const restartTimerRef = useRef<any>(null)
  const activeUtterancesRef = useRef<SpeechSynthesisUtterance[]>([])
  const chunkTimeoutRef = useRef<any>(null)
  const noSpeechStreakRef = useRef(0)
  const isSpeakingRef = useRef(false)

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

  // Handle new chat trigger from Header
  useEffect(() => {
    if (newChatTrigger > 0) {
      if (messages.length > 0) {
        setMessages([])
        sessionStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [newChatTrigger])

  // Cleanup speech synthesis and recognition on unmount
  useEffect(() => {
    return () => {
      isSpeakingRef.current = false
      isRecognizingRef.current = false
      if (chunkTimeoutRef.current) {
        clearTimeout(chunkTimeoutRef.current)
        chunkTimeoutRef.current = null
      }
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      activeUtterancesRef.current = []
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel()
        } catch {}
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {}
        try {
          recognitionRef.current.stop()
        } catch {}
        recognitionRef.current = null
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
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

  // Stop voice speaking
  const stopVoiceSpeaking = useCallback(() => {
    isSpeakingRef.current = false
    if (chunkTimeoutRef.current) {
      clearTimeout(chunkTimeoutRef.current)
      chunkTimeoutRef.current = null
    }
    activeUtterancesRef.current = []
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch {}
    }
  }, [])

  // Stop current recognition and cancel any restart timers
  const stopVoiceRecognition = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    isRecognizingRef.current = false
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {}
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }
  }, [])

  // Robust chunked TTS speech helper to prevent Chromium/Android 15s freeze bug
  const speakVoiceReply = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.()
      return
    }

    // Stop ongoing speech & mic to prevent acoustic echo or audio focus conflict
    stopVoiceSpeaking()
    stopVoiceRecognition()

    const spokenText = cleanTextForSpeech(text)
    if (!spokenText.trim()) {
      if (isVoiceCallOpenRef.current) {
        setVoiceCallStatus('listening')
      } else {
        setVoiceCallStatus('idle')
      }
      onEnd?.()
      return
    }

    setVoiceCallStatus('speaking')
    isSpeakingRef.current = true

    // Chunk into compact natural phrases (<= 32 characters) so each chunk takes ~2 seconds and never exceeds Android limits
    const chunks = chunkSpeechText(spokenText, 32)
    if (chunks.length === 0) {
      isSpeakingRef.current = false
      onEnd?.()
      return
    }

    let currentChunkIndex = 0

    const voices = window.speechSynthesis.getVoices()
    const zhVoice = voices.find((v) => v.lang.includes('zh-TW') || v.lang.includes('zh-HK') || v.lang.includes('zh'))

    const playNextChunk = () => {
      if (chunkTimeoutRef.current) {
        clearTimeout(chunkTimeoutRef.current)
        chunkTimeoutRef.current = null
      }

      if (!isSpeakingRef.current) return

      if (currentChunkIndex >= chunks.length) {
        // All chunks finished cleanly!
        isSpeakingRef.current = false
        activeUtterancesRef.current = []

        // Wait 600ms so speaker audio clears and Android releases audio focus before reopening microphone
        setTimeout(() => {
          if (isVoiceCallOpenRef.current) {
            onEnd?.()
          } else {
            setVoiceCallStatus('idle')
          }
        }, 600)
        return
      }

      const chunkText = chunks[currentChunkIndex]
      currentChunkIndex++

      const utterance = new SpeechSynthesisUtterance(chunkText)
      utterance.lang = 'zh-TW'
      utterance.rate = 1.05
      utterance.pitch = 1.0
      if (zhVoice) utterance.voice = zhVoice

      // Retain utterance reference to prevent V8 garbage collection mid-speech!
      activeUtterancesRef.current.push(utterance)
      ;(window as any).__edenUtterance = utterance

      let hasAdvanced = false
      const advance = () => {
        if (hasAdvanced) return
        hasAdvanced = true
        if (chunkTimeoutRef.current) {
          clearTimeout(chunkTimeoutRef.current)
          chunkTimeoutRef.current = null
        }
        playNextChunk()
      }

      utterance.onend = () => {
        advance()
      }

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis chunk error:', e)
        advance()
      }

      // Safety watchdog per chunk: if Android TTS drops the onend event, advance automatically
      const watchdogMs = Math.max(4500, chunkText.length * 400)
      chunkTimeoutRef.current = setTimeout(() => {
        advance()
      }, watchdogMs)

      window.speechSynthesis.speak(utterance)
    }

    playNextChunk()
  }, [stopVoiceSpeaking, stopVoiceRecognition])

  // Toggle TTS setting
  const toggleTTS = () => {
    setAutoTTS((prev) => {
      const next = !prev
      try {
        localStorage.setItem('edennote_ai_tts_enabled', String(next))
      } catch {}
      if (!next) {
        stopVoiceSpeaking()
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
        noSpeechStreakRef.current = 0
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

  // Continuous Voice Call: Start listening
  const startVoiceCallListening = () => {
    // If AI is currently speaking or voice overlay is closed, never open microphone
    if (isSpeakingRef.current || !isVoiceCallOpenRef.current) return

    // Clear any pending restart timers to prevent multiple concurrent recognizers
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }

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
      isRecognizingRef.current = true
      recognition.lang = 'zh-TW'
      recognition.continuous = false
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      let finalCaptured = ''
      const startedAt = Date.now()

      recognition.onstart = () => {
        isRecognizingRef.current = true
        setVoiceCallStatus('listening')
      }

      recognition.onresult = (e: any) => {
        // Discard any audio artifact occurring within the first 350ms of start (e.g. system chime echo)
        if (Date.now() - startedAt < 350) {
          return
        }

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

        const trimmed = (currentText || finalCaptured).trim()
        if (trimmed.length >= 2) {
          // Genuinely recognized speech: reset silence streak
          noSpeechStreakRef.current = 0
          setLiveTranscript(trimmed)
        }

        // 1.4s of silence after speech triggers sending
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
        }
        silenceTimerRef.current = setTimeout(() => {
          if (trimmed.length >= 2) {
            stopVoiceRecognition()
            void processVoiceUtterance(trimmed)
          }
        }, 1400)
      }

      recognition.onerror = (e: any) => {
        console.warn('SpeechRecognition error:', e.error)
        if (e.error === 'not-allowed') {
          setVoiceError('尚未取得麥克風授權。請點擊下方按鈕，或至手機設定允許 EdenNote 使用麥克風。')
          setVoiceCallStatus('error')
        }
        // CRITICAL: Do NOT schedule restarts inside onerror!
        // Web Speech API will ALWAYS immediately fire onend after onerror.
        // Doing restarts in both onerror and onend causes double-start collision loops and repeating chime sounds!
      }

      recognition.onend = () => {
        isRecognizingRef.current = false
        if (!isVoiceCallOpenRef.current || isSpeakingRef.current) {
          return
        }

        const trimmedFinal = finalCaptured.trim()
        if (trimmedFinal.length >= 2) {
          noSpeechStreakRef.current = 0
          void processVoiceUtterance(trimmedFinal)
          return
        }

        // No valid speech was captured during this cycle.
        // Limit restarts so phone never plays continuous chime sounds!
        noSpeechStreakRef.current++
        if (noSpeechStreakRef.current < 2) {
          // Allow at most ONE quiet retry after a 2-second delay
          restartTimerRef.current = setTimeout(() => {
            if (isVoiceCallOpenRef.current && !isSpeakingRef.current && voiceCallStatusRef.current === 'listening') {
              startVoiceCallListening()
            }
          }, 2000)
        } else {
          // Enter calm paused state without any recurring prompt sound effects
          setVoiceCallStatus('paused')
        }
      }

      recognition.start()
    } catch (err) {
      console.warn('Failed to start speech recognition:', err)
      setVoiceCallStatus('paused')
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
    noSpeechStreakRef.current = 0
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
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
    noSpeechStreakRef.current = 0
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
    stopVoiceRecognition()
    stopVoiceSpeaking()
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

  // Quick work analytics computations
  const salaryEvents = events.filter((e) => /薪|調薪|底薪|本薪|獎金|月薪|年終/.test(e.title + ' ' + (e.detail || '')))
  const overtimeEvents = events.filter((e) => /加班|工時|出勤|值班|打卡/.test(e.title + ' ' + (e.detail || '')))
  const expenseEvents = events.filter((e) => typeof e.amount === 'number' || /花費|支出|買|元|NT|扣款|費用/.test(e.title + ' ' + (e.detail || '')))
  const totalExpenses = events.reduce((sum, e) => (typeof e.amount === 'number' ? sum + e.amount : sum), 0)

  return (
    <div className="flex flex-col min-h-[calc(100dvh-130px)] pb-32 sm:pb-36">
      {activeTab === 'chat' ? (
        <>
          {/* Messages area */}
          <div className="flex-1 space-y-4 pt-2 pb-6">
            {messages.length === 0 ? (
              /* ChatGPT-style Empty Canvas with bottom-aligned prompt chips */
              <div className="flex flex-col justify-end min-h-[calc(100dvh-260px)] pb-2">
                <div className="flex flex-col items-start gap-2.5 max-w-sm animate-in fade-in duration-300">
                  <button
                    type="button"
                    onClick={() => void handleSend('分析本月生活收支與歷年調薪紀錄')}
                    className="inline-flex items-center gap-2.5 rounded-2xl bg-stone-200/70 px-4 py-2.5 text-xs font-semibold text-stone-800 shadow-sm transition hover:bg-stone-200 active:scale-95 dark:bg-[#1f2024] dark:text-stone-200 dark:hover:bg-[#2c2d33] text-left"
                  >
                    <TrendingUp size={16} className="text-stone-500 dark:text-stone-400 shrink-0" />
                    <span>分析本月收支與調薪</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInput('幫我記一筆生活備忘：')
                      textareaRef.current?.focus()
                    }}
                    className="inline-flex items-center gap-2.5 rounded-2xl bg-stone-200/70 px-4 py-2.5 text-xs font-semibold text-stone-800 shadow-sm transition hover:bg-stone-200 active:scale-95 dark:bg-[#1f2024] dark:text-stone-200 dark:hover:bg-[#2c2d33] text-left"
                  >
                    <NotebookPen size={16} className="text-stone-500 dark:text-stone-400 shrink-0" />
                    <span>編寫或編輯記事</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSend('查一下最近的醫療看病費用與健檢紀錄')}
                    className="inline-flex items-center gap-2.5 rounded-2xl bg-stone-200/70 px-4 py-2.5 text-xs font-semibold text-stone-800 shadow-sm transition hover:bg-stone-200 active:scale-95 dark:bg-[#1f2024] dark:text-stone-200 dark:hover:bg-[#2c2d33] text-left"
                  >
                    <Search size={16} className="text-stone-500 dark:text-stone-400 shrink-0" />
                    <span>查詢醫療費用紀錄</span>
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
                          : 'border border-stone-200/90 bg-white text-stone-900 rounded-tl-sm dark:border-white/10 dark:bg-[#1c1d22] dark:text-white'
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
                <div className="flex items-center gap-2 rounded-3xl rounded-tl-sm border border-stone-200/90 bg-white px-4 py-3 text-xs sm:text-sm font-medium text-stone-600 shadow-sm dark:border-white/10 dark:bg-[#1c1d22] dark:text-stone-300">
                  <LoaderCircle size={16} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                  <span>EdenNote AI 正在檢索資料庫並思考處理中…</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ========================================================================= */}
          {/* CHATGPT-STYLE FLOATING BOTTOM PILL COMPOSER (參照 ChatGPT 底部欄) */}
          {/* ========================================================================= */}
          <div
            className="fixed left-0 right-0 z-30 mx-auto max-w-2xl px-3 sm:px-6 pointer-events-none"
            style={{ bottom: 'calc(var(--app-bottom-margin, 1.75rem) + 4.25rem)' }}
          >
            <div className="pointer-events-auto relative">
              {/* Plus Action Popup Menu */}
              {showPlusMenu && (
                <div className="absolute bottom-full left-0 mb-3 w-64 rounded-3xl border border-stone-200/80 bg-white/95 p-2 shadow-2xl backdrop-blur-xl dark:border-stone-800/90 dark:bg-[#1c1d22]/95 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlusMenu(false)
                        setInput('幫我記一筆生活備忘：')
                        textareaRef.current?.focus()
                      }}
                      className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 transition"
                    >
                      <NotebookPen size={15} className="text-indigo-500" />
                      <span>吩咐新增生活記事</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlusMenu(false)
                        void handleSend('請幫我完整分析歷年調薪與工時狀況')
                      }}
                      className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 transition"
                    >
                      <TrendingUp size={15} className="text-emerald-500" />
                      <span>統計調薪與工時</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlusMenu(false)
                        void handleSend('統計最近一個月的花費與醫療支出')
                      }}
                      className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 transition"
                    >
                      <Search size={15} className="text-blue-500" />
                      <span>查詢近月消費開銷</span>
                    </button>
                    <div className="my-1 border-t border-stone-100 dark:border-stone-800" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlusMenu(false)
                        toggleTTS()
                      }}
                      className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        {autoTTS ? <Volume2 size={15} className="text-indigo-500" /> : <VolumeX size={15} className="text-stone-400" />}
                        <span>語音自動朗讀回覆</span>
                      </div>
                      <span className="text-[10px] text-stone-400 font-medium">{autoTTS ? '已開啟' : '已關閉'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlusMenu(false)
                        setShowKeyModal(true)
                      }}
                      className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 transition"
                    >
                      <KeyRound size={15} className="text-amber-500" />
                      <span>自訂 Gemini API Key</span>
                    </button>
                  </div>
                </div>
              )}

              {/* The ChatGPT Bottom Pill */}
              <div className="flex items-center gap-2 rounded-full border border-stone-300/80 bg-white/95 px-2.5 py-1.5 shadow-2xl shadow-black/10 backdrop-blur-xl dark:border-stone-800/90 dark:bg-[#18191d]/95 dark:shadow-black/50">
                {/* Left: Plus Button */}
                <button
                  type="button"
                  onClick={() => setShowPlusMenu((prev) => !prev)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 active:scale-95 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-white"
                  title="功能選單"
                >
                  <Plus size={20} strokeWidth={2.4} />
                </button>

                {/* Center: Input / Textarea */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  disabled={isSending}
                  onChange={(e) => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={isDictatingInput ? '正在聆聽您的口述...' : '問問 EdenNote AI...'}
                  className="flex-1 max-h-28 resize-none bg-transparent px-1.5 py-2 text-sm leading-relaxed text-stone-900 placeholder:text-stone-400 focus:outline-none dark:text-stone-100 dark:placeholder:text-stone-500"
                />

                {/* Right Controls: Dictation Mic, Send button (when typing), and Blue Voice Mode Wave Button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Dictation Mic Button (Speech-to-text dictation into text box) */}
                  <button
                    type="button"
                    onClick={handleDictateClick}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95 ${
                      isDictatingInput
                        ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                        : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-white'
                    }`}
                    title={isDictatingInput ? '正在語音輸入... 點擊結束' : '麥克風語音輸入'}
                  >
                    {isDictatingInput ? <MicOff size={19} /> : <Mic size={19} strokeWidth={2.2} />}
                  </button>

                  {/* Send Arrow Button (Displayed when typing) */}
                  {input.trim().length > 0 && (
                    <button
                      type="button"
                      disabled={isSending}
                      onClick={() => void handleSend()}
                      aria-label="送出"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-900 text-white shadow transition hover:bg-black active:scale-95 dark:bg-white dark:text-black dark:hover:bg-stone-200"
                    >
                      {isSending ? (
                        <LoaderCircle size={16} className="animate-spin" />
                      ) : (
                        <ArrowUp size={18} strokeWidth={2.6} />
                      )}
                    </button>
                  )}

                  {/* Blue Audio Wave Button (Exact ChatGPT Blue Voice Mode!) */}
                  <button
                    type="button"
                    onClick={openVoiceCall}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-500 active:scale-95"
                    title="開啟免持連續語音秘書（全程免碰手機）"
                  >
                    <AudioLines size={18} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ========================================================================= */
        /* WORK / ANALYSIS MODE (工作模式：數據彙整與智能洞察面板) */
        /* ========================================================================= */
        <div className="space-y-4 pt-3 pb-8 animate-in fade-in duration-200">
          {/* Header Overview Card */}
          <div className="rounded-3xl border border-stone-200/90 bg-white/90 p-4 shadow-sm dark:border-stone-800 dark:bg-[#1a1b1f]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-white">
                  EdenNote 智能工作台
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  已索引本裝置資料庫共 <strong>{events.length}</strong> 筆生活紀錄
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>即時同步中</span>
              </span>
            </div>
          </div>

          {/* 4 Feature Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Salary Card */}
            <div className="rounded-3xl border border-stone-200/90 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-[#1c1d22] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                    <TrendingUp size={16} />
                  </div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    薪資與加薪歷程
                  </h4>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
                  已收錄 {salaryEvents.length} 筆調薪與所得相關備忘。
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('chat')
                  void handleSend('請詳細分析我的歷年加薪幅度與薪資成長曲線')
                }}
                className="mt-3 inline-flex items-center justify-between w-full rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 transition"
              >
                <span>請 AI 深度分析薪資</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* 2. Overtime & Workhours Card */}
            <div className="rounded-3xl border border-stone-200/90 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-[#1c1d22] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                    <Clock size={16} />
                  </div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    工時與加班統計
                  </h4>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
                  已收錄 {overtimeEvents.length} 筆加班與出勤備忘。
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('chat')
                  void handleSend('幫我統計總加班工時與最近的加班情況')
                }}
                className="mt-3 inline-flex items-center justify-between w-full rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 transition"
              >
                <span>請 AI 統計加班工時</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* 3. Expenses Card */}
            <div className="rounded-3xl border border-stone-200/90 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-[#1c1d22] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <CircleDollarSign size={16} />
                  </div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    生活消費與財務支出
                  </h4>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
                  已記錄 {expenseEvents.length} 筆支出，總計 NT$ {totalExpenses.toLocaleString()}。
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('chat')
                  void handleSend('幫我整理所有消費支出並依類別分析')
                }}
                className="mt-3 inline-flex items-center justify-between w-full rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 transition"
              >
                <span>請 AI 彙整生活開銷</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* 4. Notes & Overview Card */}
            <div className="rounded-3xl border border-stone-200/90 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-[#1c1d22] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                    <NotebookPen size={16} />
                  </div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    生活備忘與待辦
                  </h4>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
                  隨時透過語音或打字新增、查詢醫療、工作與生活記事。
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('chat')
                  void handleSend('今天和本週有哪些重要待辦事項與記事？')
                }}
                className="mt-3 inline-flex items-center justify-between w-full rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 px-3 py-2 text-xs font-semibold text-stone-700 dark:text-stone-200 transition"
              >
                <span>檢閱本週待辦與記事</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

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
              {voiceCallStatus === 'paused' && (
                <span className="text-amber-300 font-medium">⏸️ 靜音等待中 • 點擊圓圈隨時開口</span>
              )}
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
              <button
                type="button"
                onClick={() => {
                  if (voiceCallStatus === 'paused' || voiceCallStatus === 'idle') {
                    noSpeechStreakRef.current = 0
                    startVoiceCallListening()
                  } else if (voiceCallStatus === 'listening') {
                    stopVoiceRecognition()
                    setVoiceCallStatus('paused')
                  }
                }}
                className={`relative flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-2xl shadow-purple-600/50 transition-all duration-500 active:scale-95 ${
                  voiceCallStatus === 'listening'
                    ? 'scale-105 shadow-emerald-500/40'
                    : voiceCallStatus === 'speaking'
                    ? 'scale-105 shadow-pink-500/40'
                    : 'scale-95 opacity-90'
                }`}
                title={voiceCallStatus === 'listening' ? '點擊暫停' : '點擊開始說話'}
              >
                {voiceCallStatus === 'listening' ? (
                  <Mic size={48} className="animate-pulse text-white" />
                ) : voiceCallStatus === 'speaking' ? (
                  <Volume2 size={48} className="animate-pulse text-white" />
                ) : voiceCallStatus === 'paused' ? (
                  <MicOff size={44} className="text-white/80" />
                ) : (
                  <Sparkles size={48} className="text-white" />
                )}
              </button>
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
                } else if (voiceCallStatus === 'paused' || voiceCallStatus === 'idle') {
                  noSpeechStreakRef.current = 0
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
