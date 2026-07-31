import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Camera, Check, ChevronRight, FilePlus2, Inbox, LoaderCircle, NotebookPen, Plus, Tag, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Event } from '../../models/Event'
import { attachmentRepository, eventRepository } from '../../repositories'
import { aiParserService } from '../../services/ai'
import { filesToAttachments, formatFileSize, validateAttachmentFile } from '../../utils/attachments'
import { toLocalDateInputValue } from '../../utils/localDate'
import { normalizeTags } from '../../utils/normalizeTags'
import { loadPhotoStorageMode, optimizeSelectedFiles } from '../../utils/photoStorage'
import { sortEventsNewestFirst } from '../../utils/sortEvents'
import { restoreListPosition, saveListPosition } from '../../utils/listPosition'
import DateWheelPicker from '../../components/DateWheelPicker/DateWheelPicker'
import { clearCreateEventDraft, getCreateEventDraft, saveCreateEventDraft } from '../../utils/eventDrafts'

export default function DailyPage() {
  const initialDraft = useRef(getCreateEventDraft())
  const [eventTitle, setEventTitle] = useState(() => initialDraft.current?.title ?? '')
  const [eventDetail, setEventDetail] = useState(() => initialDraft.current?.detail ?? '')
  const [eventDate, setEventDate] = useState(() => initialDraft.current?.eventDate ?? toLocalDateInputValue())
  const [pendingFiles, setPendingFiles] = useState<File[]>(() => initialDraft.current?.pendingFiles ?? [])
  const [events, setEvents] = useState<Event[]>([])
  const [eventCategory, setEventCategory] = useState(() => initialDraft.current?.category ?? '')
  const [tags, setTags] = useState<string[]>(() => initialDraft.current?.tags ?? [])
  const [tagInput, setTagInput] = useState(() => initialDraft.current?.tagInput ?? '')
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [tagOptions, setTagOptions] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  const loadEvents = useCallback(async () => {
    const items = await eventRepository.getAll()
    setEvents(sortEventsNewestFirst(items))
    setCategoryOptions([...new Set(items.map(({ category }) => category.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'zh-TW')))
    setTagOptions([...new Set(items.flatMap(({ tags }) => tags).map((tag) => tag.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'zh-TW')))
    setIsLoadingEvents(false)
  }, [])

  useEffect(() => {
    void loadEvents().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : '事件載入失敗')
      setIsLoadingEvents(false)
    })
  }, [loadEvents])

  useEffect(() => {
    if (!isLoadingEvents) restoreListPosition('/daily')
  }, [isLoadingEvents])

  useEffect(() => {
    saveCreateEventDraft({ eventDate, title: eventTitle, detail: eventDetail, category: eventCategory, tags, tagInput, pendingFiles })
  }, [eventDate, eventTitle, eventDetail, eventCategory, tags, tagInput, pendingFiles])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedTitle = eventTitle.trim()
    const normalizedDetail = eventDetail.trim()
    const normalizedCategory = eventCategory.trim()
    if ((!normalizedTitle && !normalizedDetail) || !eventDate || isSaving || isProcessingFiles) return

    const resolvedTitle = normalizedTitle || normalizedDetail.split(/\r?\n/)[0]
    const resolvedDetail = normalizedDetail || normalizedTitle
    const resolvedCategory = normalizedCategory || '未分類'

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const parsedEvent = await aiParserService.parseEvent(resolvedDetail)
      const timestamp = new Date().toISOString()
      const eventId = crypto.randomUUID()
      const attachments = filesToAttachments(pendingFiles, eventId)
      const newEvent: Event = {
        id: eventId,
        date: eventDate,
        title: resolvedTitle,
        detail: resolvedDetail,
        category: resolvedCategory,
        ...(parsedEvent.amount !== undefined ? { amount: parsedEvent.amount } : {}),
        tags: normalizeTags([...tags, tagInput]),
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
      setEventTitle('')
      setEventDetail('')
      setEventDate(toLocalDateInputValue())
      setEventCategory('')
      setTags([])
      setTagInput('')
      setPendingFiles([])
      clearCreateEventDraft()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '事件儲存失敗')
    } finally {
      setIsSaving(false)
    }
  }

  const selectFiles = async (inputEvent: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(inputEvent.target.files ?? [])
    inputEvent.target.value = ''
    const firstError = selected.map(validateAttachmentFile).find(Boolean)
    if (firstError) {
      setErrorMessage(firstError)
      return
    }
    setErrorMessage(null)
    setIsProcessingFiles(true)
    try {
      const prepared = await optimizeSelectedFiles(selected, loadPhotoStorageMode())
      setPendingFiles((current) => [...current, ...prepared])
    } finally {
      setIsProcessingFiles(false)
    }
  }

  const addTags = (values: string[]) => {
    setTags((current) => normalizeTags([...current, ...values]))
  }

  const handleTagInput = (value: string) => {
    if (!value.includes(',')) {
      setTagInput(value)
      return
    }
    const parts = value.split(',')
    addTags(parts.slice(0, -1))
    setTagInput(parts[parts.length - 1] ?? '')
  }

  const handleTagKeyDown = (keyboardEvent: KeyboardEvent<HTMLInputElement>) => {
    if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ',') return
    keyboardEvent.preventDefault()
    addTags([tagInput])
    setTagInput('')
  }

  return (
    <main className="page-enter">
      <form onSubmit={handleSubmit}>
        <div className="create-event-heading">
          <span className="create-event-heading-icon" aria-hidden="true"><NotebookPen size={27} strokeWidth={2.2} /></span>
          <div>
            <h2>新增事件</h2>
            <p>建立一筆新的 Daily Record</p>
          </div>
        </div>
        <div className="mb-3">
          <label className="detail-field-label mb-2" htmlFor="daily-event-date">事件日期</label>
          <DateWheelPicker id="daily-event-date" value={eventDate} onChange={setEventDate} required />
        </div>
        <div className="form-section-heading mt-4">
          <label className="detail-field-label" htmlFor="daily-event-title">Title</label>
          <button type="submit" className="inline-save-button" disabled={(!eventTitle.trim() && !eventDetail.trim()) || !eventDate || isSaving || isProcessingFiles}>
            {isSaving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
            儲存
          </button>
        </div>
        <div className="clearable-field mt-2">
          <input
            id="daily-event-title"
            className="detail-input !mt-0 !pr-12"
            value={eventTitle}
            onChange={(event) => setEventTitle(event.target.value)}
            placeholder="輸入事件標題"
          />
          <button type="button" className="clear-field-button" onClick={() => setEventTitle('')} aria-label="清除事件標題" disabled={!eventTitle}><X size={17} /></button>
        </div>

        <label className="detail-field-label mt-4" htmlFor="daily-event">Detail</label>
        <section className="editor-card relative mt-2">
          <textarea
            id="daily-event"
            className="create-event-textarea !pr-14"
            value={eventDetail}
            onChange={(event) => setEventDetail(event.target.value)}
            placeholder={'寫下想記錄的事\n例如 : Eden 中樂透彩'}
          />
          <button type="button" className="clear-field-button !top-3 !translate-y-0" onClick={() => setEventDetail('')} aria-label="清除事件內容" disabled={!eventDetail}><X size={17} /></button>
          <div className="editor-toolbar">
            <button type="button" className="tool-button" onClick={() => photoInputRef.current?.click()}><Camera size={19} />照片</button>
            <button type="button" className="tool-button" onClick={() => attachmentInputRef.current?.click()}><FilePlus2 size={19} />附件</button>
            <span className="flex items-center justify-center text-xs font-semibold text-stone-400">{isProcessingFiles ? '處理照片中…' : `${pendingFiles.length} 個檔案`}</span>
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

        <label className="detail-field-label mt-5" htmlFor="daily-event-category">分類</label>
        <div className="category-composer mt-2">
          <label className="category-input-field" htmlFor="daily-event-category">
            <input
              id="daily-event-category"
              type="text"
              value={eventCategory}
              onChange={(event) => setEventCategory(event.target.value)}
              placeholder="輸入新增分類或點選現有分類如下"
              autoComplete="off"
            />
          </label>
          {categoryOptions.length > 0 && (
          <div className="category-options-panel" aria-label="資料分類">
            <div className="category-options-heading">
              <span>資料分類</span>
              <small>{categoryOptions.length} 個分類</small>
            </div>
            <div className="category-options-list">
              {categoryOptions.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={`category-option ${eventCategory === option ? 'category-option-active' : ''}`}
                  onClick={() => setEventCategory(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          )}
        </div>

        <label className="detail-field-label mt-5" htmlFor="daily-event-tags">Tags</label>
        <div className="tag-editor">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span className="editable-tag" key={tag}>
                {tag}
                <button type="button" onClick={() => setTags((current) => current.filter((item) => item !== tag))} aria-label={`移除 ${tag}`}><X size={13} /></button>
              </span>
            ))}
          </div>
          <div className="tag-input-row">
            <Plus size={16} aria-hidden="true" />
            <input
              id="daily-event-tags"
              value={tagInput}
              onChange={(event) => handleTagInput(event.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => { addTags([tagInput]); setTagInput('') }}
              placeholder="輸入 Tag，按 Enter 或逗號新增"
            />
          </div>
          {tagOptions.length > 0 && (
            <label className="existing-tag-select">
              <Tag size={16} aria-hidden="true" />
              <span>選擇既有 Tag</span>
              <select
                defaultValue=""
                onChange={(selectEvent) => {
                  if (!selectEvent.target.value) return
                  addTags([selectEvent.target.value])
                  selectEvent.target.value = ''
                }}
              >
                <option value="">請選擇</option>
                {tagOptions.map((tag) => <option value={tag} key={tag} disabled={tags.includes(tag)}>{tag}</option>)}
              </select>
            </label>
          )}
        </div>
        <p className="mt-2 text-xs leading-5 text-stone-400">空白與重複的 Tags 會自動移除。</p>

        {errorMessage && <p className="error-notice" role="alert">{errorMessage}</p>}

        <button type="submit" className="primary-button" disabled={(!eventTitle.trim() && !eventDetail.trim()) || !eventDate || isSaving || isProcessingFiles}>
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
            <Link className="event-row event-row-link" to={`/daily/${event.id}`} key={event.id} data-event-id={event.id} onClick={() => saveListPosition('/daily', event.id)}>
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
