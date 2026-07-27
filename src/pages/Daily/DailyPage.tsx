import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Camera, Check, ChevronRight, FilePlus2, LoaderCircle, RotateCcw, Search, SlidersHorizontal, Tag, X } from 'lucide-react'
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
  const [categories, setCategories] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [tag, setTag] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const searchRequest = useRef(0)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  const loadEvents = useCallback(async () => {
    const requestId = ++searchRequest.current
    const items = await eventRepository.search({ keyword, category, tag, dateFrom, dateTo })
    if (requestId === searchRequest.current) {
      setEvents(sortEventsNewestFirst(items))
      setIsLoadingEvents(false)
    }
  }, [category, dateFrom, dateTo, keyword, tag])

  const loadCategories = useCallback(async () => {
    const items = await eventRepository.getAll()
    setCategories([...new Set(items.map((event) => event.category))].sort((a, b) => a.localeCompare(b)))
    setAvailableTags([...new Set(items.flatMap((event) => event.tags))].sort((a, b) => a.localeCompare(b)))
  }, [])

  useEffect(() => {
    void loadEvents().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : '事件載入失敗')
      setIsLoadingEvents(false)
    })
  }, [loadEvents])

  useEffect(() => {
    void loadCategories().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : '篩選選項載入失敗')
    })
  }, [loadCategories])

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
        category: parsedEvent.category,
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
      await Promise.all([loadEvents(), loadCategories()])
      setRawText('')
      setEventDate(toLocalDateInputValue())
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

  const hasFilters = Boolean(keyword || category || tag || dateFrom || dateTo)
  const resetFilters = () => {
    setKeyword('')
    setCategory('')
    setTag('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <main className="page-enter">
      <form onSubmit={handleSubmit}>
        <label className="section-label block" htmlFor="daily-event">新增事件</label>
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
            placeholder={'今天發生什麼事？\n\n例如：\n今天跟 Dell VP 討論 Volta EVT 延一週。'}
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

        {errorMessage && <p className="error-notice" role="alert">{errorMessage}</p>}

        <button type="submit" className="primary-button" disabled={!rawText.trim() || !eventDate || isSaving}>
          {isSaving ? <LoaderCircle size={19} className="animate-spin" /> : <Check size={19} />}
          {isSaving ? '儲存中' : '儲存'}
        </button>
      </form>

      <section className="mt-9" aria-labelledby="filters-title">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 id="filters-title" className="section-label !mb-0 flex items-center gap-2"><SlidersHorizontal size={14} />搜尋與篩選</h2>
          {hasFilters && <button type="button" className="reset-filter-button" onClick={resetFilters}><RotateCcw size={13} />清除</button>}
        </div>
        <div className="filter-card">
          <label className="search-field" htmlFor="event-search">
            <Search size={18} />
            <input id="event-search" type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜尋標題、內容或 Tag" />
          </label>
          <div className="filter-grid">
            <label className="filter-field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">全部</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="filter-field"><span>開始日期</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} /></label>
            <label className="filter-field"><span>結束日期</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} /></label>
          </div>
          <label className="filter-field mt-2"><span>Tag</span><select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">全部 Tags</option>{availableTags.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          {tag && (
            <div className="active-tag-filter" aria-label="目前使用中的 Tag 篩選">
              <Tag size={13} aria-hidden="true" />
              <span>{tag}</span>
              <button type="button" onClick={() => setTag('')} aria-label="清除 Tag 篩選"><X size={13} /></button>
            </div>
          )}
        </div>
      </section>

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
          )) : <div className="empty-timeline"><Search size={22} /><p>找不到符合條件的事件</p>{hasFilters && <button type="button" onClick={resetFilters}>清除篩選</button>}</div>}
        </div>
      </section>
    </main>
  )
}
