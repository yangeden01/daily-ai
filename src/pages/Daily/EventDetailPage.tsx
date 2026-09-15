import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { ArrowLeft, Check, Copy, Download, FileText, LoaderCircle, Moon, Pencil, Sparkles, Sun, Trash2, Undo2, X } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Attachment } from '../../models/Attachment'
import type { Event, CalendarType } from '../../models/Event'
import { attachmentRepository, eventRepository } from '../../repositories'
import { filesToAttachments, formatFileSize } from '../../utils/attachments'
import { normalizeTags } from '../../utils/normalizeTags'
import { deleteEventWithAttachments } from '../../services/EventDeletionService'
import { copyEventWithAttachments } from '../../services/EventCopyService'
import DateWheelPicker from '../../components/DateWheelPicker/DateWheelPicker'
import { clearEditEventDraft, getEditEventDraft, saveEditEventDraft } from '../../utils/eventDrafts'
import { clearTabDestination, tabBaseForReturnTo } from '../../utils/tabNavigationMemory'
import { appModeFromSearch, routeForMode } from '../../utils/appMode'
import { isAnniversaryEvent, isDailyEvent, isNoteEvent } from '../../utils/noteEvents'
import { formatLunarDateText, convertLunarToSolarYMD, formatSolarDateWithWeekday, getTodayLunarDate, formatSolarMonthDay, parseSolarMonthDay } from '../../utils/anniversary'
import { AnniversaryDateSelector } from '../../components/Anniversary/AnniversaryDateSelector'
import { LinkifiedText } from '../../components/LinkifiedText'
import { EditorIndentToolbar } from '../../components/EditorIndentToolbar/EditorIndentToolbar'
import { AttachmentPicker } from '../../components/AttachmentPicker/AttachmentPicker'
import { CategoryField } from '../../components/EventEditor/CategoryField'
import { TagsField } from '../../components/EventEditor/TagsField'
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
    : returnTo.startsWith('/dashboard?') ? (routeState?.returnLabel ?? 'Dashboard') : (mode === 'anniversary' ? '紀念日' : 'Timeline')
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
  const [lastClearedTitle, setLastClearedTitle] = useState<string | null>(null)
  const [lastClearedDetail, setLastClearedDetail] = useState<string | null>(null)

  // Anniversary state (Month & Day only, no year)
  const [calendarType, setCalendarType] = useState<CalendarType>('solar')
  const [lunarMonth, setLunarMonth] = useState<number>(() => getTodayLunarDate().month)
  const [lunarDay, setLunarDay] = useState<number>(() => getTodayLunarDate().day)
  const [isLeapMonth, setIsLeapMonth] = useState<boolean>(() => getTodayLunarDate().isLeap)

  const detailInputRef = useRef<HTMLTextAreaElement>(null)
  const isNote = event ? isNoteEvent(event) : mode === 'notes'
  const isAnniversary = event ? isAnniversaryEvent(event) : mode === 'anniversary'

  useEffect(() => {
    if (!eventId) return
    const todayLunar = getTodayLunarDate()
    Promise.all([eventRepository.getById(eventId), attachmentRepository.getByEventId(eventId), eventRepository.getAll()])
      .then(([item, files, allEvents]) => {
        setEvent(item ?? null)
        setAttachments(files)
        const filterFn = item && isAnniversaryEvent(item) ? isAnniversaryEvent : item && isNoteEvent(item) ? isNoteEvent : isDailyEvent
        const matchingEvents = allEvents.filter(filterFn)
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
          setCalendarType(draft.calendarType ?? item.calendarType ?? 'solar')
          setLunarMonth(draft.lunarMonth ?? item.lunarMonth ?? todayLunar.month)
          setLunarDay(draft.lunarDay ?? item.lunarDay ?? todayLunar.day)
          setIsLeapMonth(draft.isLeapMonth ?? item.isLeapMonth ?? todayLunar.isLeap)
          setIsEditing(true)
        } else if (item) {
          setCalendarType(item.calendarType ?? 'solar')
          setLunarMonth(item.lunarMonth ?? todayLunar.month)
          setLunarDay(item.lunarDay ?? todayLunar.day)
          setIsLeapMonth(item.isLeapMonth ?? todayLunar.isLeap)
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
    saveEditEventDraft(eventId, {
      eventDate,
      title,
      detail,
      category,
      tags,
      tagInput,
      newFiles,
      removedAttachmentIds,
      calendarType,
      lunarMonth,
      lunarDay,
      isLeapMonth,
    })
  }, [eventId, isEditing, eventDate, title, detail, category, tags, tagInput, newFiles, removedAttachmentIds, calendarType, lunarMonth, lunarDay, isLeapMonth])

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
      setCalendarType(draft.calendarType ?? event.calendarType ?? 'solar')
      setLunarMonth(draft.lunarMonth ?? event.lunarMonth ?? 8)
      setLunarDay(draft.lunarDay ?? event.lunarDay ?? 15)
      setIsLeapMonth(draft.isLeapMonth ?? event.isLeapMonth ?? false)
      setLastClearedTitle(null)
      setLastClearedDetail(null)
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
    setCalendarType(event.calendarType ?? 'solar')
    setLunarMonth(event.lunarMonth ?? 8)
    setLunarDay(event.lunarDay ?? 15)
    setIsLeapMonth(event.isLeapMonth ?? false)
    setLastClearedTitle(null)
    setLastClearedDetail(null)
    setErrorMessage(null)
    setIsEditing(true)
  }

  const handleClearTitle = () => {
    if (!title) return
    setLastClearedTitle(title)
    setTitle('')
  }

  const handleRestoreTitle = () => {
    if (!lastClearedTitle) return
    setTitle(lastClearedTitle)
    setLastClearedTitle(null)
  }

  const handleClearDetail = () => {
    if (!detail) return
    setLastClearedDetail(detail)
    setDetail('')
  }

  const handleRestoreDetail = () => {
    if (!lastClearedDetail) return
    setDetail(lastClearedDetail)
    setLastClearedDetail(null)
  }

  const handleCancelEdit = () => {
    if (!event) return

    const isDateChanged = !isNote && !isAnniversary && eventDate !== event.date
    const isTitleChanged = title !== event.title
    const isDetailChanged = detail !== event.detail
    const isCategoryChanged = category !== event.category
    const isTagsChanged = JSON.stringify(tags) !== JSON.stringify(event.tags) || Boolean(tagInput.trim())
    const isFilesChanged = newFiles.length > 0 || removedAttachmentIds.length > 0
    const isCalendarChanged = isAnniversary && (
      calendarType !== (event.calendarType ?? 'solar') ||
      lunarMonth !== (event.lunarMonth ?? 8) ||
      lunarDay !== (event.lunarDay ?? 15) ||
      isLeapMonth !== Boolean(event.isLeapMonth)
    )

    const hasChanges = isDateChanged || isTitleChanged || isDetailChanged || isCategoryChanged || isTagsChanged || isFilesChanged || isCalendarChanged

    if (hasChanges) {
      const confirmed = window.confirm('確定要放棄未儲存的變更並不儲存跳出嗎？\n\n您所編輯的內容將不會被儲存。')
      if (!confirmed) return
    }

    if (eventId) {
      clearEditEventDraft(eventId)
    }

    setEventDate(event.date)
    setTitle(event.title)
    setDetail(event.detail)
    setCategory(event.category)
    setTags([...event.tags])
    setTagInput('')
    setNewFiles([])
    setRemovedAttachmentIds([])
    setCalendarType(event.calendarType ?? 'solar')
    setLunarMonth(event.lunarMonth ?? 8)
    setLunarDay(event.lunarDay ?? 15)
    setIsLeapMonth(Boolean(event.isLeapMonth))
    setLastClearedTitle(null)
    setLastClearedDetail(null)
    setErrorMessage(null)
    setIsEditing(false)
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
    if (!event || (!isNote && !isAnniversary && !eventDate) || (!normalizedTitle && !normalizedDetail) || isSaving || isProcessingFiles) return

    const resolvedTitle = normalizedTitle || normalizedDetail.split(/\r?\n/)[0]
    const resolvedDetail = normalizedDetail || normalizedTitle
    const resolvedCategory = category.trim() || (isAnniversary ? '紀念日' : '未分類')

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
        
        let newEventDate = eventDate
        if (isNote) {
          newEventDate = ''
        } else if (isAnniversary) {
          if (calendarType === 'solar') {
            const { month: sm, day: sd } = parseSolarMonthDay(eventDate)
            newEventDate = `${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`
          } else {
            newEventDate = `${String(lunarMonth).padStart(2, '0')}-${String(lunarDay).padStart(2, '0')}`
          }
        }

        await eventRepository.update(event.id, {
          ...event,
          date: newEventDate,
          title: resolvedTitle,
          detail: resolvedDetail,
          category: resolvedCategory,
          tags: nextTags,
          attachmentIds,
          updatedAt: timestamp,
          ...(isNote ? { updateCount: (event.updateCount ?? 0) + 1, lastEditedAt: timestamp } : {}),
          ...(isAnniversary ? {
            calendarType,
            ...(calendarType === 'lunar' ? { lunarMonth, lunarDay, isLeapMonth } : {}),
          } : {}),
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
        calendarType: copied.calendarType,
        lunarMonth: copied.lunarMonth,
        lunarDay: copied.lunarDay,
        isLeapMonth: copied.isLeapMonth,
      })
      navigate(routeForMode(`/daily/${copied.id}`, isAnniversary ? 'anniversary' : isNote ? 'notes' : 'daily'), {
        replace: true,
        state: { returnTo, returnLabel },
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : isAnniversary ? '紀念日複製失敗' : isNote ? '記事複製失敗' : '事件複製失敗')
      setIsCopying(false)
    }
  }

  if (isLoading) {
    return <main className="detail-state"><LoaderCircle className="animate-spin" size={24} /><span>載入中...</span></main>
  }

  if (!event) {
    return <main className="detail-state"><p>{errorMessage ?? '找不到這筆事件。'}</p><Link to={returnTo} className="detail-back-link">返回 {returnLabel}</Link></main>
  }

  const isLunar = event.calendarType === 'lunar'
  const lunarText = isLunar && event.lunarMonth && event.lunarDay
    ? formatLunarDateText(event.lunarMonth, event.lunarDay, event.isLeapMonth)
    : null

  const currentYear = new Date().getFullYear()
  const solarThisYear = isLunar && event.lunarMonth && event.lunarDay
    ? convertLunarToSolarYMD(currentYear, event.lunarMonth, event.lunarDay, event.isLeapMonth)
    : null

  return (
    <main className="page-enter">
      <div className="mb-5 flex items-center justify-between">
        <Link to={returnTo} className="detail-back-link"><ArrowLeft size={17} />{returnLabel}</Link>
        {!isEditing && <button type="button" className="edit-button" onClick={startEditing}><Pencil size={16} />Edit</button>}
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="detail-card p-5 sm:p-6">
          <div className="form-section-heading">
            {isAnniversary ? (
              <p className="detail-field-label">編輯紀念日</p>
            ) : isNote ? (
              <p className="detail-field-label">編輯記事</p>
            ) : (
              <label className="detail-field-label" htmlFor="event-date">事件日期</label>
            )}
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="inline-cancel-button"
                onClick={handleCancelEdit}
                title="放棄修改並不儲存跳出"
              >
                <X size={15} />
                <span>不儲存跳出</span>
              </button>
              <button
                type="submit"
                className="inline-save-button"
                disabled={(!isNote && !isAnniversary && !eventDate) || (!title.trim() && !detail.trim()) || isSaving || isProcessingFiles}
              >
                {isSaving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
                <span>儲存</span>
              </button>
            </div>
          </div>

          {isAnniversary ? (
            <div className="mb-4">
              <AnniversaryDateSelector
                calendarType={calendarType}
                onCalendarTypeChange={setCalendarType}
                solarDate={eventDate}
                onSolarDateChange={setEventDate}
                lunarMonth={lunarMonth}
                onLunarMonthChange={setLunarMonth}
                lunarDay={lunarDay}
                onLunarDayChange={setLunarDay}
                isLeapMonth={isLeapMonth}
                onIsLeapMonthChange={setIsLeapMonth}
              />
            </div>
          ) : !isNote ? (
            <DateWheelPicker id="event-date" value={eventDate} onChange={setEventDate} required />
          ) : null}

          <label className="detail-field-label mt-5" htmlFor="event-title">Title</label>
          <div className="clearable-field mt-2">
            <input
              id="event-title"
              className="detail-input !mt-0 !pr-12"
              value={title}
              onChange={(inputEvent) => {
                const nextVal = inputEvent.target.value
                if (title && !nextVal) {
                  setLastClearedTitle(title)
                }
                setTitle(nextVal)
              }}
            />
            {title ? (
              <button
                type="button"
                className="clear-field-button"
                onClick={handleClearTitle}
                aria-label="清除事件標題"
                title="清除標題"
              >
                <X size={17} />
              </button>
            ) : lastClearedTitle ? (
              <button
                type="button"
                className="clear-field-button !bg-indigo-50 !text-indigo-600 hover:!bg-indigo-100 dark:!bg-indigo-950/60 dark:!text-indigo-300"
                onClick={handleRestoreTitle}
                aria-label="回復標題"
                title="回復剛清除的標題"
              >
                <Undo2 size={17} />
              </button>
            ) : (
              <button type="button" className="clear-field-button" disabled aria-label="清除事件標題">
                <X size={17} />
              </button>
            )}
          </div>

          <label className="detail-field-label mt-5" htmlFor="event-detail">Detail</label>
          <div className="clearable-field mt-2">
            <textarea
              ref={detailInputRef}
              id="event-detail"
              className="detail-input !mt-0 min-h-40 resize-y !pr-12"
              value={detail}
              onChange={(inputEvent) => {
                const nextVal = inputEvent.target.value
                if (detail && !nextVal) {
                  setLastClearedDetail(detail)
                }
                setDetail(nextVal)
              }}
              onKeyDown={handleDetailKeyDown}
            />
            {detail ? (
              <button
                type="button"
                className="clear-field-button !top-3 !translate-y-0"
                onClick={handleClearDetail}
                aria-label="清除事件內容"
                title="清除內容"
              >
                <X size={17} />
              </button>
            ) : lastClearedDetail ? (
              <button
                type="button"
                className="clear-field-button !top-3 !translate-y-0 !bg-indigo-50 !text-indigo-600 hover:!bg-indigo-100 dark:!bg-indigo-950/60 dark:!text-indigo-300"
                onClick={handleRestoreDetail}
                aria-label="回復內容"
                title="回復剛清除的內容"
              >
                <Undo2 size={17} />
              </button>
            ) : (
              <button type="button" className="clear-field-button !top-3 !translate-y-0" disabled aria-label="清除事件內容">
                <X size={17} />
              </button>
            )}
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

          <CategoryField
            id="event-category"
            value={category}
            options={categoryOptions}
            onChange={setCategory}
          />

          <TagsField
            id="event-tags"
            tags={tags}
            inputValue={tagInput}
            options={tagOptions}
            onInputChange={handleTagInput}
            onInputKeyDown={handleTagKeyDown}
            onInputBlur={() => {
              addTags([tagInput])
              setTagInput('')
            }}
            onRemoveTag={removeTag}
            onOptionSelect={(selectedTag) => addTags([selectedTag])}
          />

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
            <button
              type="button"
              className="detail-secondary-button"
              onClick={handleCancelEdit}
              disabled={isSaving}
              title="放棄未儲存的變更並不儲存跳出"
            >
              <X size={17} />
              <span>不儲存跳出</span>
            </button>
            <button type="submit" className="detail-save-button" disabled={(!isNote && !isAnniversary && !eventDate) || (!title.trim() && !detail.trim()) || isSaving || isProcessingFiles}>
              {isSaving ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}
              <span>儲存</span>
            </button>
          </div>
        </form>
      ) : (
        <>
          <section className="detail-card">
            <div className="border-b border-stone-100 p-5 dark:border-white/10 sm:p-6">
              {isAnniversary ? (
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    isLunar ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}>
                    {isLunar ? <Moon size={13} /> : <Sun size={13} />}
                    {isLunar ? (lunarText ?? '農曆') : `國曆每年 ${formatSolarMonthDay(event.date)}`}
                  </span>
                </div>
              ) : isNote ? (
                <p className="event-date !col-span-1">最近修改：{formatDateTime(event.lastEditedAt ?? event.updatedAt)}</p>
              ) : (
                <time className="event-date !col-span-1" dateTime={event.date}>{event.date}</time>
              )}
              
              <h2 className="mt-2 whitespace-pre-wrap text-2xl font-bold tracking-tight text-stone-950 dark:text-white">
                <LinkifiedText text={event.title} />
              </h2>
              <span className="event-category mt-3 inline-block">{event.category}</span>

              {isAnniversary && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-indigo-50/80 p-2.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <Sparkles size={14} className="shrink-0 text-indigo-500" />
                  <span>
                    今年 ({currentYear}) {isLunar ? '對應國曆：' : '紀念日：'}
                    <strong className="font-bold">
                      {isLunar
                        ? (solarThisYear ? formatSolarDateWithWeekday(solarThisYear) : '')
                        : (() => {
                            const { month: sm, day: sd } = parseSolarMonthDay(event.date)
                            return formatSolarDateWithWeekday(`${currentYear}-${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`)
                          })()}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            <div className="p-5 sm:p-6">
              <p className="detail-label">Detail</p>
              <div className="whitespace-pre-wrap text-[15px] leading-7 text-stone-700 dark:text-stone-300">
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
              </div>

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
            {isCopying ? '複製中' : isAnniversary ? '複製紀念日' : isNote ? '複製記事' : '複製事件'}
          </button>
          <button type="button" className="delete-event-button" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <LoaderCircle size={18} className="animate-spin" /> : <Trash2 size={18} />}
            {isDeleting ? '刪除中' : isAnniversary ? '刪除紀念日' : isNote ? '刪除記事' : '刪除事件'}
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
