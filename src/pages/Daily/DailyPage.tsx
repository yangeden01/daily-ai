import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Camera, Check, ChevronRight, FilePlus2, Inbox, LoaderCircle, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Event } from '../../models/Event'
import { attachmentRepository, eventRepository } from '../../repositories'
import { aiParserService } from '../../services/ai'
import { filesToAttachments, formatFileSize, validateAttachmentFile } from '../../utils/attachments'
import { toLocalDateInputValue } from '../../utils/localDate'
import { sortEventsNewestFirst } from '../../utils/sortEvents'

export default function DailyPage() {
  const [rawText, setRawText] = useState('')
  const [eventDate, setEventDate] = useState(() => toLocalDateInputValue())
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [eventCategory, setEventCategory] = useState('')
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  const loadEvents = useCallback(async () => {
    const items = await eventRepository.getAll()
    setEvents(sortEventsNewestFirst(items))
    setCategoryOptions([...new Set(items.map(({ category }) => category.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'zh-TW')))
    setIsLoadingEvents(false)
  }, [])

  useEffect(() => {
    void loadEvents().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : '事件載入失敗')
      setIsLoadingEvents(false)
    })
  }, [loadEvents])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedText = rawText.trim()
    if (!normalizedText || !eventDate || isSaving) return

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const parsedEvent = await aiParserService.parseEvent(normalizedText)
      const timestamp = new Date().toISOString()
      const eventId = crypto.randomUUID()
      const attachments = filesToAttachments(pendingFiles, eventId)
      const newEvent: Event = {
        id: eventId,
        date: eventDate,
        title: parsedEvent.title,
        detail: parsedEvent.rawText,
        category: eventCategory.trim() || parsedEvent.category,
        ...(parsedEvent.amount !== undefined ? { amount: parsedEvent.amount } : {}),
        tags: [...parsedEvent.tags],
        attachmentIds: attachments.map(({ id }) => id),
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      await attachmentRepository.addMany(attachments)
      try {
        await eventRepository.add(newEvent)
      } catch (error) {
        await attachmentRepository.deleteByEventId(eventId)
        throw error
      }
      await loadEvents()
      setRawText('')
      setEventDate(toLocalDateInputValue())
      setEventCategory('')
      setPendingFiles([])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '事件儲存失敗')
    } finally {
      setIsSaving(false)
    }
  }

  const selectFiles = (inputEvent: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(inputEvent.target.files ?? [])
    inputEvent.target.value = ''
    const firstError = selected.map(validateAttachmentFile).find(Boolean)
    if (firstError) {
      setErrorMessage(firstError)
      return
    }
    setErrorMessage(null)
    setPendingFiles((current) => [...current, ...selected])
  }

  return (
    <main className="page-enter">
      <form onSubmit={handleSubmit}>
        <label className="section-label block !text-sm !font-bold !text-stone-700 dark:!text-stone-200" htmlFor="daily-event">新增事件</label>
        <label className="filter-field mb-3" htmlFor="daily-event-date">
          <span>事件日期</span>
          <input
            id="daily-event-date"
            type="date"
            value={eventDate}
            onChange={(event) => setEventDate(event.target.value)}
            required
          />
        </label>
        <section className="editor-card">
          <textarea
            id="daily-event"
            className="create-event-textarea"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder={'寫下想記錄的事\n\n例如：\nEden 計畫環遊世界'}
          />
          <div className="editor-toolbar">
            <button type="button" className="tool-button" onClick={() => photoInputRef.current?.click()}><Camera size={19} />照片</button>
            <button type="button" className="tool-button" onClick={() => attachmentInputRef.current?.click()}><FilePlus2 size={19} />附件</button>
            <span className="flex items-center justify-center text-xs font-semibold text-stone-400">{pendingFiles.length} 個檔案</span>
          </div>
        </section>

        <input ref={photoInputRef} aria-label="選擇照片檔案" className="sr-only" type="file" accept="image/*" multiple onChange={selectFiles} />
        <input ref={attachmentInputRef} aria-label="選擇附件檔案" className="sr-only" type="file" multiple onChange={selectFiles} />
        {pendingFiles.length > 0 && (
          <div className="pending-file-list">
            {pendingFiles.map((file, index) => (
              <div className="pending-file" key={`${file.name}-${file.lastModified}-${index}`}>
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <small>{formatFileSize(file.size)}</small>
                <button type="button" onClick={() => setPendingFiles((files) => files.filter((_, itemIndex) => itemIndex !== index))} aria-label={`移除 ${file.name}`}><X size={15} /></button>
              </div>
            ))}
          </div>
        )}

        <label className="filter-field mt-3" htmlFor="daily-event-category">
          <span className="!text-sm !font-bold !text-stone-700 dark:!text-stone-200">分類</span>
          <input
            id="daily-event-category"
            type="text"
            value={eventCategory}
            onChange={(event) => setEventCategory(event.target.value)}
            placeholder="輸入新分類或從下方選擇"
            autoComplete="off"
          />
        </label>
        {categoryOptions.length > 0 && (
          <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 p-3 dark:border-white/10 dark:bg-white/5" aria-label="過去資料分類">
            <p className="mb-2 text-xs font-semibold text-stone-500 dark:text-stone-400">過去資料分類</p>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={`rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${eventCategory === option ? 'border-indigo-500 bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200' : 'border-stone-200 bg-white text-stone-700 hover:border-indigo-300 dark:border-white/10 dark:bg-stone-900 dark:text-stone-300'}`}
                  onClick={() => setEventCategory(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {errorMessage && <p className="error-notice" role="alert">{errorMessage}</p>}

        <button type="submit" className="primary-button" disabled={!rawText.trim() || !eventDate || isSaving}>
          {isSaving ? <LoaderCircle size={19} className="animate-spin" /> : <Check size={19} />}
          {isSaving ? '儲存中' : '儲存'}
        </button>
      </form>

      <section className="mt-9" aria-labelledby="timeline-title">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 id="timeline-title" className="section-label !mb-0">Timeline</h2>
          <span className="text-xs tabular-nums text-stone-400">{events.length} events</span>
        </div>
        <div className="event-list">
          {isLoadingEvents ? <div className="empty-timeline"><LoaderCircle className="animate-spin" size={22} /><p>載入 Timeline…</p></div> : events.length > 0 ? events.map((event) => (
            <Link className="event-row event-row-link" to={`/daily/${event.id}`} key={event.id}>
              <time className="event-date" dateTime={event.date}>{event.date}</time>
              <h3 className="event-title">{event.title}</h3>
              <span className="flex items-center gap-2">
                <span className="event-category">{event.category}</span>
                <ChevronRight size={16} className="text-stone-300 dark:text-stone-600" />
              </span>
            </Link>
          )) : <div className="empty-timeline"><Inbox size={22} /><p>目前還沒有事件</p></div>}
        </div>
      </section>
    </main>
  )
}
