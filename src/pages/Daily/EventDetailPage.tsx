import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { ArrowLeft, Check, Copy, Download, FileText, LoaderCircle, Pencil, Plus, Tag, Trash2, X } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Attachment } from '../../models/Attachment'
import type { Event } from '../../models/Event'
import { attachmentRepository, eventRepository } from '../../repositories'
import { filesToAttachments, formatFileSize } from '../../utils/attachments'
import { normalizeTags } from '../../utils/normalizeTags'
import { deleteEventWithAttachments } from '../../services/EventDeletionService'
import { copyEventWithAttachments } from '../../services/EventCopyService'
import DateWheelPicker from '../../components/DateWheelPicker/DateWheelPicker'
import { clearEditEventDraft, getEditEventDraft, saveEditEventDraft } from '../../utils/eventDrafts'
import { clearTabDestination, tabBaseForReturnTo } from '../../utils/tabNavigationMemory'
import { appModeFromSearch, routeForMode } from '../../utils/appMode'
import { isDailyEvent, isNoteEvent } from '../../utils/noteEvents'
import { LinkifiedText } from '../../components/LinkifiedText'
import { EditorIndentToolbar } from '../../components/EditorIndentToolbar/EditorIndentToolbar'
import { AttachmentPicker } from '../../components/AttachmentPicker/AttachmentPicker'
import { handleListEditingKey, parseTodoLine, toggleTodoLineAt, type ListEditingKey } from '../../utils/textFormatting'
import { prepareSelectedAttachments } from '../../services/AttachmentPreparationService'

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as { returnTo?: string; returnLabel?: string } | null
  const requestedReturnTo = routeState?.returnTo
  const mode = appModeFromSearch(location.search)
  const returnTo = requestedReturnTo?.startsWith('/ai?') || requestedReturnTo?.startsWith('/dashboard?') || requestedReturnTo?.startsWith('/daily?')
    ? requestedReturnTo
    : routeForMode('/daily', mode)
  const returnLabel = returnTo.startsWith('/ai?')
    ? (routeState?.returnLabel ?? 'Search')
    : returnTo.startsWith('/dashboard?') ? (routeState?.returnLabel ?? 'Dashboard') : 'Timeline'
  const [event, setEvent] = useState<Event | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [activePhoto, setActivePhoto] = useState<Attachment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [eventDate, setEventDate] = useState('')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [category, setCategory] = useState('')
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tagOptions, setTagOptions] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const detailInputRef = useRef<HTMLTextAreaElement>(null)
  const isNote = event ? isNoteEvent(event) : mode === 'notes'

  useEffect(() => {
    if (!eventId) return
    Promise.all([eventRepository.getById(eventId), attachmentRepository.getByEventId(eventId), eventRepository.getAll()])
      .then(([item, files, allEvents]) => {
        setEvent(item ?? null)
        setAttachments(files)
        const matchingEvents = allEvents.filter(item && isNoteEvent(item) ? isNoteEvent : isDailyEvent)
        setCategoryOptions([...new Set(matchingEvents.map(({ category }) => category.trim()).filter(Boolean))]
          .sort((left, right) => left.localeCompare(right, 'zh-TW')))
        setTagOptions([...new Set(matchingEvents.flatMap(({ tags }) => tags).map((tag) => tag.trim()).filter(Boolean))]
          .sort((left, right) => left.localeCompare(right, 'zh-TW')))
        const draft = eventId ? getEditEventDraft(eventId) : null
        if (item && draft) {
          setEventDate(draft.eventDate)
          setTitle(draft.title)
          setDetail(draft.detail)
          setCategory(draft.category)
          setTags([...draft.tags])
          setTagInput(draft.tagInput)
          setNewFiles([...draft.newFiles])
          setRemovedAttachmentIds([...draft.removedAttachmentIds])
          setIsEditing(true)
        }
      })
      .catch(() => setErrorMessage('事件或附件載入失敗'))
      .finally(() => setIsLoading(false))
  }, [eventId])

  useEffect(() => {
    const urls = Object.fromEntries(attachments
      .filter((attachment) => attachment.type === 'image' && attachment.blob)
      .map((attachment) => [attachment.id, URL.createObjectURL(attachment.blob!)]))
    setAttachmentUrls(urls)
    return () => Object.values(urls).forEach(URL.revokeObjectURL)
  }, [attachments])

  useEffect(() => {
    if (!eventId || !isEditing) return
    saveEditEventDraft(eventId, { eventDate, title, detail, category, tags, tagInput, newFiles, removedAttachmentIds })
  }, [eventId, isEditing, eventDate, title, detail, category, tags, tagInput, newFiles, removedAttachmentIds])

  const startEditing = () => {
    if (!event) return
    const draft = eventId ? getEditEventDraft(eventId) : null
    if (draft) {
      setEventDate(draft.eventDate)
      setTitle(draft.title)
      setDetail(draft.detail)
      setCategory(draft.category)
      setTags([...draft.tags])
      setTagInput(draft.tagInput)
      setNewFiles([...draft.newFiles])
      setRemovedAttachmentIds([...draft.removedAttachmentIds])
      setErrorMessage(null)
      setIsEditing(true)
      return
    }
    setEventDate(event.date)
    setTitle(event.title)
    setDetail(event.detail)
    setCategory(event.category)
    setTags([...event.tags])
    setTagInput('')
    setNewFiles([])
    setRemovedAttachmentIds([])
    setErrorMessage(null)
    setIsEditing(true)
  }

  const handleDetailClick = (clickEvent: ReactMouseEvent<HTMLElement>) => {
    const target = clickEvent.target as HTMLElement
    if (target.closest('a, button, input, select, textarea')) return
    startEditing()
  }

  const handleToggleTodo = async (lineIndex: number) => {
    if (!event || isEditing) return
    const nextDetail = toggleTodoLineAt(event.detail, lineIndex)
    if (nextDetail === event.detail) return

    setErrorMessage(null)
    try {
      const timestamp = new Date().toISOString()
      const updatedEvent: Event = {
        ...event,
        detail: nextDetail,
        updatedAt: timestamp,
        ...(isNote
          ? {
              updateCount: (event.updateCount ?? 0) + 1,
              lastEditedAt: timestamp,
            }
          : {}),
      }
      await eventRepository.update(event.id, updatedEvent)
      setEvent(updatedEvent)
    } catch {
      setErrorMessage('待辦狀態更新失敗')
    }
  }

  const handleSave = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault()
    const normalizedTitle = title.trim()
    const normalizedDetail = detail.trim()
    if (!event || (!isNote && !eventDate) || (!normalizedTitle && !normalizedDetail) || isSaving || isProcessingFiles) return

    const resolvedTitle = normalizedTitle || normalizedDetail.split(/\r?\n/)[0]
    const resolvedDetail = normalizedDetail || normalizedTitle
    const resolvedCategory = category.trim() || '未分類'

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const addedAttachments = filesToAttachments(newFiles, event.id)
      await attachmentRepository.addMany(addedAttachments)
      try {
        const timestamp = new Date().toISOString()
        const nextTags = normalizeTags([...tags, tagInput])
        const attachmentIds = [
          ...attachments.filter(({ id }) => !removedAttachmentIds.includes(id)).map(({ id }) => id),
          ...addedAttachments.map(({ id }) => id),
        ]
        const changed = event.date !== (isNote ? '' : eventDate) || event.title !== resolvedTitle || event.detail !== resolvedDetail ||
          event.category !== resolvedCategory || JSON.stringify(event.tags) !== JSON.stringify(nextTags) ||
          JSON.stringify(event.attachmentIds) !== JSON.stringify(attachmentIds)
        await eventRepository.update(event.id, {
          ...event,
          date: isNote ? '' : eventDate,
          title: resolvedTitle,
          detail: resolvedDetail,
          category: resolvedCategory,
          tags: nextTags,
          attachmentIds,
          updatedAt: timestamp,
          ...(isNote && changed ? { updateCount: (event.updateCount ?? 0) + 1, lastEditedAt: timestamp } : {}),
        })
      } catch (error) {
        await Promise.all(addedAttachments.map(({ id }) => attachmentRepository.delete(id)))
        throw error
      }
      await Promise.all(removedAttachmentIds.map((id) => attachmentRepository.delete(id)))
      if (eventId) clearEditEventDraft(eventId)
      clearTabDestination(tabBaseForReturnTo(returnTo))
      navigate(returnTo)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '事件更新失敗')
      setIsSaving(false)
    }
  }

  const selectFiles = async (inputEvent: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(inputEvent.target.files ?? [])
    inputEvent.target.value = ''
    setErrorMessage(null)
    setIsProcessingFiles(true)
    try {
      const prepared = await prepareSelectedAttachments(selected)
      setNewFiles((current) => [...current, ...prepared])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '檔案處理失敗')
    } finally {
      setIsProcessingFiles(false)
    }
  }

  const downloadAttachment = (attachment: Attachment) => {
    if (!attachment.blob) {
      setErrorMessage('此備份只包含附件 metadata，沒有可下載的實際檔案。')
      return
    }
    const url = URL.createObjectURL(attachment.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = attachment.filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
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

  const handleDetailKeyDown = (keyboardEvent: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!['Enter', 'Backspace', 'Tab'].includes(keyboardEvent.key)) return
    const result = handleListEditingKey(
      detail,
      keyboardEvent.currentTarget.selectionStart,
      keyboardEvent.currentTarget.selectionEnd,
      keyboardEvent.key as ListEditingKey,
      keyboardEvent.shiftKey,
    )
    if (!result) return
    keyboardEvent.preventDefault()
    setDetail(result.value)
    requestAnimationFrame(() => {
      detailInputRef.current?.focus()
      detailInputRef.current?.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  const removeTag = (tagToRemove: string) => {
    setTags((current) => current.filter((tag) => tag !== tagToRemove))
  }

  const handleDelete = async () => {
    if (!event || isDeleting) return
    const confirmed = window.confirm(`確定要刪除「${event.title}」嗎？\n\n此動作無法復原。`)
    if (!confirmed) return

    setIsDeleting(true)
    setErrorMessage(null)

    try {
      await deleteEventWithAttachments(event)
      if (eventId) clearEditEventDraft(eventId)
      clearTabDestination(tabBaseForReturnTo(returnTo))
      navigate(returnTo, { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '事件刪除失敗')
      setIsDeleting(false)
    }
  }

  const handleCopy = async () => {
    if (!event || isCopying) return
    setIsCopying(true)
    setErrorMessage(null)

    try {
      const copied = await copyEventWithAttachments(event, attachments)
      saveEditEventDraft(copied.id, {
        eventDate: copied.date,
        title: copied.title,
        detail: copied.detail,
        category: copied.category,
        tags: [...copied.tags],
        tagInput: '',
        newFiles: [],
        removedAttachmentIds: [],
      })
      navigate(routeForMode(`/daily/${copied.id}`, isNote ? 'notes' : 'daily'), {
        replace: true,
        state: { returnTo, returnLabel },
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : isNote ? '記事複製失敗' : '事件複製失敗')
      setIsCopying(false)
    }
  }

  if (isLoading) {
    return <main className="detail-state"><LoaderCircle className="animate-spin" size={24} /><span>載入事件</span></main>
  }

  if (!event) {
    return <main className="detail-state"><p>{errorMessage ?? '找不到這筆事件。'}</p><Link to={returnTo} className="detail-back-link">返回 {returnLabel}</Link></main>
  }

  return (
    <main className="page-enter">
      <div className="mb-5 flex items-center justify-between">
        <Link to={returnTo} className="detail-back-link"><ArrowLeft size={17} />{returnLabel}</Link>
        {!isEditing && <button type="button" className="edit-button" onClick={startEditing}><Pencil size={16} />Edit</button>}
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="detail-card p-5 sm:p-6">
          <div className="form-section-heading">
            {isNote ? (
              <p className="detail-field-label">編輯記事</p>
            ) : (
              <label className="detail-field-label" htmlFor="event-date">事件日期</label>
            )}
            <button type="submit" className="inline-save-button" disabled={(!isNote && !eventDate) || (!title.trim() && !detail.trim()) || isSaving || isProcessingFiles}>
              {isSaving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
              儲存
            </button>
          </div>
          {!isNote && <DateWheelPicker id="event-date" value={eventDate} onChange={setEventDate} required />}

          <label className="detail-field-label mt-5" htmlFor="event-title">Title</label>
          <div className="clearable-field mt-2">
            <input id="event-title" className="detail-input !mt-0 !pr-12" value={title} onChange={(inputEvent) => setTitle(inputEvent.target.value)} />
            <button type="button" className="clear-field-button" onClick={() => setTitle('')} aria-label="清除事件標題" disabled={!title}><X size={17} /></button>
          </div>

          <label className="detail-field-label mt-5" htmlFor="event-detail">Detail</label>
          <div className="clearable-field mt-2">
            <textarea ref={detailInputRef} id="event-detail" className="detail-input !mt-0 min-h-40 resize-y !pr-12" value={detail} onChange={(inputEvent) => setDetail(inputEvent.target.value)} onKeyDown={handleDetailKeyDown} />
            <button type="button" className="clear-field-button !top-3 !translate-y-0" onClick={() => setDetail('')} aria-label="清除事件內容" disabled={!detail}><X size={17} /></button>
          </div>
          <EditorIndentToolbar
            textareaRef={detailInputRef}
            value={detail}
            onChange={setDetail}
            trailing={(
              <AttachmentPicker
                count={attachments.filter(({ id }) => !removedAttachmentIds.includes(id)).length + newFiles.length}
                isProcessing={isProcessingFiles}
                onSelectFiles={selectFiles}
              />
            )}
          />

          <label className="detail-field-label mt-5" htmlFor="event-category">分類</label>
          <div className="category-composer mt-2">
            <label className="category-input-field" htmlFor="event-category">
              <input id="event-category" value={category} onChange={(inputEvent) => setCategory(inputEvent.target.value)} placeholder="輸入新增分類或點選現有分類如下" autoComplete="off" />
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
                    className={`category-option ${category === option ? 'category-option-active' : ''}`}
                    onClick={() => setCategory(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            )}
          </div>

          <label className="detail-field-label mt-5" htmlFor="event-tags">Tags</label>
          <div className="tag-editor">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span className="editable-tag" key={tag}>
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} aria-label={`移除 ${tag}`}><X size={13} /></button>
                </span>
              ))}
            </div>
            <div className="tag-input-row">
              <Plus size={16} aria-hidden="true" />
              <input
                id="event-tags"
                value={tagInput}
                onChange={(inputEvent) => handleTagInput(inputEvent.target.value)}
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

          <div className="mt-3 space-y-2">
            {isProcessingFiles && <p className="text-xs text-stone-400">正在處理照片…</p>}
            {attachments.filter(({ id }) => !removedAttachmentIds.includes(id)).map((attachment) => (
              <div className="pending-file" key={attachment.id}><span className="min-w-0 flex-1 truncate">{attachment.filename}</span><small>{formatFileSize(attachment.size)}</small><button type="button" onClick={() => setRemovedAttachmentIds((ids) => [...ids, attachment.id])} aria-label={`移除 ${attachment.filename}`}><X size={15} /></button></div>
            ))}
            {newFiles.map((file, index) => (
              <div className="pending-file" key={`${file.name}-${file.lastModified}-${index}`}><span className="min-w-0 flex-1 truncate">{file.name}</span><small>{formatFileSize(file.size)}</small><button type="button" onClick={() => setNewFiles((files) => files.filter((_, itemIndex) => itemIndex !== index))} aria-label={`移除 ${file.name}`}><X size={15} /></button></div>
            ))}
          </div>
          {errorMessage && <p className="error-notice" role="alert">{errorMessage}</p>}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" className="detail-secondary-button" onClick={() => { if (eventId) clearEditEventDraft(eventId); clearTabDestination(tabBaseForReturnTo(returnTo)); setIsEditing(false) }} disabled={isSaving}><X size={17} />取消</button>
            <button type="submit" className="detail-save-button" disabled={(!isNote && !eventDate) || (!title.trim() && !detail.trim()) || isSaving || isProcessingFiles}>
              {isSaving ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}
              儲存
            </button>
          </div>
        </form>
      ) : (
        <>
          <section className="detail-card">
            <div className="border-b border-stone-100 p-5 dark:border-white/10 sm:p-6">
              {isNote ? <p className="event-date !col-span-1">最近修改：{formatDateTime(event.lastEditedAt ?? event.updatedAt)}</p> : <time className="event-date !col-span-1" dateTime={event.date}>{event.date}</time>}
              <h2 className="mt-2 whitespace-pre-wrap text-2xl font-bold tracking-tight text-stone-950 dark:text-white">
                <LinkifiedText text={event.title} />
              </h2>
              <span className="event-category mt-3 inline-block">{event.category}</span>
            </div>

            <div className="p-5 sm:p-6">
              <p className="detail-label">Detail</p>
              <p className="whitespace-pre-wrap text-[15px] leading-7 text-stone-700 dark:text-stone-300">
                <div
                  className="event-detail-editable"
                  aria-label="點擊以編輯 Detail"
                  onClick={handleDetailClick}
                >
                  {event.detail.split('\n').map((line, lineIndex) => {
                    const todo = parseTodoLine(line)
                    if (todo) {
                      return (
                        <div
                          className={`event-detail-line event-detail-todo${todo.checked ? ' is-checked' : ''}`}
                          key={`${lineIndex}-${line}`}
                        >
                          <button
                            type="button"
                            className="event-detail-todo-toggle"
                            aria-label={`${todo.checked ? '取消完成' : '標記完成'}：${todo.content || '待辦事項'}`}
                            aria-pressed={todo.checked}
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation()
                              void handleToggleTodo(lineIndex)
                            }}
                          >
                            {todo.checked ? '☑' : '☐'}
                          </button>
                          <span>
                            <LinkifiedText text={todo.content} />
                          </span>
                        </div>
                      )
                    }

                    return (
                      <div className="event-detail-line" key={`${lineIndex}-${line}`}>
                        <LinkifiedText text={line || '\u00a0'} />
                      </div>
                    )
                  })}
                </div>
              </p>

              <p className="detail-label mt-7">Tags</p>
              <div className="flex flex-wrap gap-2">
                {event.tags.length > 0 ? event.tags.map((tag) => <span className="tag-chip" key={tag}>{tag}</span>) : <span className="text-sm text-stone-400">No tags</span>}
              </div>

              {attachments.some(({ type }) => type === 'image') && (
                <>
                  <p className="detail-label mt-7">Photos</p>
                  <div className="photo-grid">
                    {attachments.filter(({ type }) => type === 'image').map((attachment) => attachmentUrls[attachment.id] ? (
                      <button type="button" key={attachment.id} onClick={() => setActivePhoto(attachment)} aria-label={`查看 ${attachment.filename}`}>
                        <img src={attachmentUrls[attachment.id]} alt={attachment.filename} />
                      </button>
                    ) : null)}
                  </div>
                </>
              )}

              {attachments.some(({ type }) => type !== 'image') && (
                <>
                  <p className="detail-label mt-7">Attachments</p>
                  <div className="attachment-list">
                    {attachments.filter(({ type }) => type !== 'image').map((attachment) => (
                      <div className="attachment-row" key={attachment.id}>
                        <FileText size={19} aria-hidden="true" />
                        <div className="min-w-0 flex-1"><strong>{attachment.filename}</strong><span>{attachment.mimeType} · {formatFileSize(attachment.size)}</span></div>
                        <button type="button" onClick={() => downloadAttachment(attachment)} aria-label={`下載 ${attachment.filename}`}><Download size={17} /></button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-7 grid grid-cols-2 gap-3">
                <div className="metric-card"><span>Attachments</span><strong>{attachments.filter(({ type }) => type !== 'image').length}</strong></div>
                <div className="metric-card"><span>Photos</span><strong>{attachments.filter(({ type }) => type === 'image').length}</strong></div>
              </div>
            </div>

            <dl className="detail-meta">
              <div><dt>Created</dt><dd>{formatDateTime(event.createdAt)}</dd></div>
              <div><dt>Updated</dt><dd>{formatDateTime(event.updatedAt)}</dd></div>
            </dl>
          </section>

          {errorMessage && <p className="error-notice" role="alert">{errorMessage}</p>}
          <button type="button" className="detail-secondary-button mt-4 w-full" onClick={handleCopy} disabled={isCopying || isDeleting}>
            {isCopying ? <LoaderCircle size={18} className="animate-spin" /> : <Copy size={18} />}
            {isCopying ? '複製中' : isNote ? '複製記事' : '複製事件'}
          </button>
          <button type="button" className="delete-event-button" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <LoaderCircle size={18} className="animate-spin" /> : <Trash2 size={18} />}
            {isDeleting ? '刪除中' : isNote ? '刪除記事' : '刪除事件'}
          </button>
          {activePhoto && attachmentUrls[activePhoto.id] && (
            <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={activePhoto.filename} onClick={() => setActivePhoto(null)}>
              <button type="button" onClick={() => setActivePhoto(null)} aria-label="關閉照片"><X size={22} /></button>
              <img src={attachmentUrls[activePhoto.id]} alt={activePhoto.filename} onClick={(clickEvent) => clickEvent.stopPropagation()} />
            </div>
          )}
        </>
      )}
    </main>
  )
}
