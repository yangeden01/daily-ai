import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { CalendarHeart, Check, ChevronRight, Clock, Inbox, LoaderCircle, Moon, NotebookPen, Sparkles, Sun, Undo2, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import type { Event, CalendarType } from '../../models/Event'
import { attachmentRepository, eventRepository } from '../../repositories'
import { filesToAttachments, formatFileSize } from '../../utils/attachments'
import { toLocalDateInputValue } from '../../utils/localDate'
import { normalizeTags } from '../../utils/normalizeTags'
import { sortEventsNewestFirst } from '../../utils/sortEvents'
import { restoreListPosition, saveListPosition } from '../../utils/listPosition'
import DateWheelPicker from '../../components/DateWheelPicker/DateWheelPicker'
import { clearCreateEventDraft, getCreateEventDraft, saveCreateEventDraft } from '../../utils/eventDrafts'
import { appModeFromSearch, routeForMode } from '../../utils/appMode'
import { isAnniversaryEvent, isDailyEvent, isFutureDailyEvent, isNoteEvent, isTodoNote, noteUpdatedAt, sortNotes, type NoteSort } from '../../utils/noteEvents'
import { formatLunarDateText, formatSolarMonthDay, getEventMonth, getTodayLunarDate, parseSolarMonthDay, sortAnniversaries } from '../../utils/anniversary'
import { AnniversaryDateSelector } from '../../components/Anniversary/AnniversaryDateSelector'
import { EditorIndentToolbar } from '../../components/EditorIndentToolbar/EditorIndentToolbar'
import { AttachmentPicker } from '../../components/AttachmentPicker/AttachmentPicker'
import { CategoryField } from '../../components/EventEditor/CategoryField'
import { TagsField } from '../../components/EventEditor/TagsField'
import { LinkifiedText } from '../../components/LinkifiedText'
import { handleListEditingKey, type ListEditingKey } from '../../utils/textFormatting'
import { prepareSelectedAttachments } from '../../services/AttachmentPreparationService'

export default function DailyPage() {
  const location = useLocation()
  const mode = appModeFromSearch(location.search)
  const isNotesMode = mode === 'notes'
  const isAnniversaryMode = mode === 'anniversary'
  const initialDraft = useRef(getCreateEventDraft(mode))
  const [eventTitle, setEventTitle] = useState(() => initialDraft.current?.title ?? '')
  const [eventDetail, setEventDetail] = useState(() => initialDraft.current?.detail ?? '')
  const [eventDate, setEventDate] = useState(() => initialDraft.current?.eventDate ?? (isAnniversaryMode ? toLocalDateInputValue().slice(5) : toLocalDateInputValue()))
  const [pendingFiles, setPendingFiles] = useState<File[]>(() => initialDraft.current?.pendingFiles ?? [])
  const [events, setEvents] = useState<Event[]>([])
  const [eventCategory, setEventCategory] = useState(() => initialDraft.current?.category ?? '')
  const [tags, setTags] = useState<string[]>(() => initialDraft.current?.tags ?? [])
  const [tagInput, setTagInput] = useState(() => initialDraft.current?.tagInput ?? '')
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [tagOptions, setTagOptions] = useState<string[]>([])
  const [noteSort, setNoteSort] = useState<NoteSort>('recent')
  const [isSaving, setIsSaving] = useState(false)
  const [isProcessingFiles, setIsProcessingFiles] = useState(false)
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // Anniversary specific state (Month & Day only, no year)
  const [calendarType, setCalendarType] = useState<CalendarType>(() => initialDraft.current?.calendarType ?? 'solar')
  const [lunarMonth, setLunarMonth] = useState<number>(() => initialDraft.current?.lunarMonth ?? getTodayLunarDate().month)
  const [lunarDay, setLunarDay] = useState<number>(() => initialDraft.current?.lunarDay ?? getTodayLunarDate().day)
  const [isLeapMonth, setIsLeapMonth] = useState<boolean>(() => initialDraft.current?.isLeapMonth ?? getTodayLunarDate().isLeap)
  const [lastClearedTitle, setLastClearedTitle] = useState<string | null>(null)
  const [lastClearedDetail, setLastClearedDetail] = useState<string | null>(null)

  const handleClearTitle = () => {
    if (!eventTitle) return
    setLastClearedTitle(eventTitle)
    setEventTitle('')
  }

  const handleRestoreTitle = () => {
    if (!lastClearedTitle) return
    setEventTitle(lastClearedTitle)
    setLastClearedTitle(null)
  }

  const handleClearDetail = () => {
    if (!eventDetail) return
    setLastClearedDetail(eventDetail)
    setEventDetail('')
  }

  const handleRestoreDetail = () => {
    if (!lastClearedDetail) return
    setEventDetail(lastClearedDetail)
    setLastClearedDetail(null)
  }

  const detailInputRef = useRef<HTMLTextAreaElement>(null)
  const draftModeRef = useRef(mode)

  const loadEvents = useCallback(async () => {
    const items = await eventRepository.getAll()
    let visibleItems: Event[] = []
    if (isAnniversaryMode) {
      visibleItems = items.filter(isAnniversaryEvent)
      setEvents(sortAnniversaries(visibleItems))
    } else if (isNotesMode) {
      visibleItems = items.filter(isNoteEvent)
      setEvents(sortNotes(visibleItems, noteSort))
    } else {
      visibleItems = items.filter(isDailyEvent)
      setEvents(sortEventsNewestFirst(visibleItems))
    }

    setCategoryOptions([...new Set(visibleItems.map(({ category }) => category.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'zh-TW')))
    setTagOptions([...new Set(visibleItems.flatMap(({ tags }) => tags).map((tag) => tag.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'zh-TW')))
    setIsLoadingEvents(false)
  }, [isAnniversaryMode, isNotesMode, noteSort])

  useEffect(() => {
    void loadEvents().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : '事件載入失敗')
      setIsLoadingEvents(false)
    })
  }, [loadEvents])

  useEffect(() => {
    const draft = getCreateEventDraft(mode)
    setEventTitle(draft?.title ?? '')
    setEventDetail(draft?.detail ?? '')
    setEventDate(draft?.eventDate ?? (mode === 'anniversary' ? toLocalDateInputValue().slice(5) : toLocalDateInputValue()))
    setEventCategory(draft?.category ?? '')
    setTags(draft?.tags ?? [])
    setTagInput(draft?.tagInput ?? '')
    setPendingFiles(draft?.pendingFiles ?? [])
    setCalendarType(draft?.calendarType ?? 'solar')
    const currentLunar = getTodayLunarDate()
    setLunarMonth(draft?.lunarMonth ?? currentLunar.month)
    setLunarDay(draft?.lunarDay ?? currentLunar.day)
    setIsLeapMonth(draft?.isLeapMonth ?? currentLunar.isLeap)
  }, [mode])

  useEffect(() => {
    if (!isLoadingEvents) restoreListPosition(routeForMode('/daily', mode))
  }, [isLoadingEvents, mode])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('action') === 'new') {
      const cat = params.get('category')
      if (cat) {
        setEventCategory(cat)
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
      const timer = setTimeout(() => {
        const titleInput = document.getElementById('daily-event-title') as HTMLInputElement | null
        titleInput?.focus()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [location.search])

  useEffect(() => {
    if (draftModeRef.current !== mode) {
      draftModeRef.current = mode
      return
    }
    saveCreateEventDraft({
      eventDate,
      title: eventTitle,
      detail: eventDetail,
      category: eventCategory,
      tags,
      tagInput,
      pendingFiles,
      calendarType,
      lunarMonth,
      lunarDay,
      isLeapMonth,
    }, mode)
  }, [eventDate, eventTitle, eventDetail, eventCategory, tags, tagInput, pendingFiles, mode, calendarType, lunarMonth, lunarDay, isLeapMonth])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedTitle = eventTitle.trim()
    const normalizedDetail = eventDetail.trim()
    const normalizedCategory = eventCategory.trim()
    if ((!normalizedTitle && !normalizedDetail) || (!isNotesMode && !isAnniversaryMode && !eventDate) || isSaving || isProcessingFiles) return

    const resolvedTitle = normalizedTitle || normalizedDetail.split(/\r?\n/)[0]
    const resolvedDetail = normalizedDetail || normalizedTitle
    const resolvedCategory = normalizedCategory || (isAnniversaryMode ? '紀念日' : '未分類')

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const timestamp = new Date().toISOString()
      const eventId = crypto.randomUUID()
      const attachments = filesToAttachments(pendingFiles, eventId)
      
      let newEventDate = eventDate
      if (isNotesMode) {
        newEventDate = ''
      } else if (isAnniversaryMode) {
        if (calendarType === 'solar') {
          const { month: sm, day: sd } = parseSolarMonthDay(eventDate)
          newEventDate = `${String(sm).padStart(2, '0')}-${String(sd).padStart(2, '0')}`
        } else {
          newEventDate = `${String(lunarMonth).padStart(2, '0')}-${String(lunarDay).padStart(2, '0')}`
        }
      }

      const newEvent: Event = {
        id: eventId,
        date: newEventDate,
        title: resolvedTitle,
        detail: resolvedDetail,
        category: resolvedCategory,
        tags: normalizeTags([...tags, tagInput]),
        attachmentIds: attachments.map(({ id }) => id),
        createdAt: timestamp,
        updatedAt: timestamp,
        recordType: isAnniversaryMode ? 'anniversary' : isNotesMode ? 'note' : 'daily',
        ...(isNotesMode ? { updateCount: 0, lastEditedAt: timestamp } : {}),
        ...(isAnniversaryMode ? {
          calendarType,
          ...(calendarType === 'lunar' ? { lunarMonth, lunarDay, isLeapMonth } : {}),
        } : {}),
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
      setEventDate(isAnniversaryMode ? toLocalDateInputValue().slice(5) : toLocalDateInputValue())
      setEventCategory('')
      setTags([])
      setTagInput('')
      setPendingFiles([])
      setCalendarType('solar')
      const resetLunar = getTodayLunarDate()
      setLunarMonth(resetLunar.month)
      setLunarDay(resetLunar.day)
      setIsLeapMonth(resetLunar.isLeap)
      clearCreateEventDraft(mode)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '事件儲存失敗')
    } finally {
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
      setPendingFiles((current) => [...current, ...prepared])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '檔案處理失敗')
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

  const handleDetailKeyDown = (keyboardEvent: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!['Enter', 'Backspace', 'Tab'].includes(keyboardEvent.key)) return
    const result = handleListEditingKey(
      eventDetail,
      keyboardEvent.currentTarget.selectionStart,
      keyboardEvent.currentTarget.selectionEnd,
      keyboardEvent.key as ListEditingKey,
      keyboardEvent.shiftKey,
    )
    if (!result) return
    keyboardEvent.preventDefault()
    setEventDetail(result.value)
    requestAnimationFrame(() => {
      detailInputRef.current?.focus()
      detailInputRef.current?.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  const headingTitle = isAnniversaryMode ? '新增紀念日' : isNotesMode ? '新增記事' : '新增日常事件'
  const headingSubtitle = isAnniversaryMode ? '記錄生日、週年紀念、節日（支援國曆與農曆）' : isNotesMode ? '建立一筆可重複使用的 Notes' : '建立一筆新的 Daily Record'
  const HeadingIcon = isAnniversaryMode ? CalendarHeart : isNotesMode ? NotebookPen : NotebookPen

  return (
    <main className="page-enter">
      <form onSubmit={handleSubmit}>
        <div className="create-event-heading">
          <span className="create-event-heading-icon" aria-hidden="true"><HeadingIcon size={27} strokeWidth={2.2} /></span>
          <div>
            <h2>{headingTitle}</h2>
            <p>{headingSubtitle}</p>
          </div>
        </div>

        {isAnniversaryMode ? (
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
        ) : !isNotesMode ? (
          <div className="mb-3">
            <label className="detail-field-label mb-2" htmlFor="daily-event-date">事件日期</label>
            <DateWheelPicker id="daily-event-date" value={eventDate} onChange={setEventDate} required />
          </div>
        ) : null}

        <div className="form-section-heading mt-4">
          <label className="detail-field-label" htmlFor="daily-event-title">Title</label>
          <button type="submit" className="inline-save-button" disabled={(!eventTitle.trim() && !eventDetail.trim()) || (!isNotesMode && !isAnniversaryMode && !eventDate) || isSaving || isProcessingFiles}>
            {isSaving ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
            儲存
          </button>
        </div>
        <div className="clearable-field mt-2">
          <input
            id="daily-event-title"
            className="detail-input !mt-0 !pr-12"
            value={eventTitle}
            onChange={(event) => {
              setEventTitle(event.target.value)
              if (event.target.value) setLastClearedTitle(null)
            }}
            placeholder={isAnniversaryMode ? '例如：媽媽生日、結婚紀念日、中秋節' : isNotesMode ? '輸入記事標題' : '輸入事件標題'}
          />
          {eventTitle ? (
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

        <label className="detail-field-label mt-4" htmlFor="daily-event">Detail</label>
        <section className="editor-card relative mt-2">
          <textarea
            ref={detailInputRef}
            id="daily-event"
            className="create-event-textarea !pr-14"
            value={eventDetail}
            onChange={(event) => {
              setEventDetail(event.target.value)
              if (event.target.value) setLastClearedDetail(null)
            }}
            onKeyDown={handleDetailKeyDown}
            placeholder={isAnniversaryMode
              ? '寫下紀念日備忘或慶祝安排\n例如 : 餐廳訂位、想送的禮物清單'
              : isNotesMode
              ? '寫下想記錄的事\n例如 : Eden 環遊世界清單列表'
              : '寫下想記錄的事\n例如 : Eden 中樂透彩'}
          />
          {eventDetail ? (
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
          <EditorIndentToolbar
            textareaRef={detailInputRef}
            value={eventDetail}
            onChange={setEventDetail}
            trailing={<AttachmentPicker count={pendingFiles.length} isProcessing={isProcessingFiles} onSelectFiles={selectFiles} />}
          />
        </section>

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

        <CategoryField
          id="daily-event-category"
          value={eventCategory}
          options={categoryOptions}
          onChange={setEventCategory}
        />

        <TagsField
          id="daily-event-tags"
          tags={tags}
          inputValue={tagInput}
          options={tagOptions}
          onInputChange={handleTagInput}
          onInputKeyDown={handleTagKeyDown}
          onInputBlur={() => {
            addTags([tagInput])
            setTagInput('')
          }}
          onRemoveTag={(tag) => setTags((current) => current.filter((item) => item !== tag))}
          onOptionSelect={(tag) => addTags([tag])}
        />

        {errorMessage && <p className="error-notice" role="alert">{errorMessage}</p>}

        <button type="submit" className="primary-button" disabled={(!eventTitle.trim() && !eventDetail.trim()) || (!isNotesMode && !isAnniversaryMode && !eventDate) || isSaving || isProcessingFiles}>
          {isSaving ? <LoaderCircle size={19} className="animate-spin" /> : <Check size={19} />}
          {isSaving ? '儲存中' : '儲存'}
        </button>
      </form>

      <section className="mt-9" aria-labelledby="timeline-title">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 id="timeline-title" className="section-label !mb-0">
            {isAnniversaryMode ? '紀念日列表' : isNotesMode ? '記事列表' : 'Timeline'}
          </h2>
          <span className="text-xs tabular-nums text-stone-400">
            {events.length} {isAnniversaryMode ? '個紀念日' : isNotesMode ? 'notes' : 'events'}
          </span>
        </div>
        {isNotesMode && (
          <div className="note-sort-switch" role="group" aria-label="記事排序">
            <button type="button" className={noteSort === 'recent' ? 'active' : ''} onClick={() => setNoteSort('recent')}>最近修改</button>
            <button type="button" className={noteSort === 'frequent' ? 'active' : ''} onClick={() => setNoteSort('frequent')}>頻繁更新</button>
          </div>
        )}
        <div className="event-list">
          {isLoadingEvents ? (
            <div className="empty-timeline"><LoaderCircle className="animate-spin" size={22} /><p>載入列表…</p></div>
          ) : events.length > 0 ? (
            events.map((event) => {
              const isLunar = event.calendarType === 'lunar'
              const lunarText = isLunar && event.lunarMonth && event.lunarDay
                ? formatLunarDateText(event.lunarMonth, event.lunarDay, event.isLeapMonth)
                : null
              const eventMonth = getEventMonth(event)
              const isFuture = !isAnniversaryMode && !isNotesMode && isFutureDailyEvent(event)
              const isTodo = isNotesMode && isTodoNote(event)
              const monthClass = isTodo
                ? 'event-row-todo'
                : isFuture
                  ? 'event-row-future'
                  : (eventMonth % 2 === 0 ? 'event-row-month-even' : 'event-row-month-odd')

              return (
                <Link
                  className={`event-row event-row-link ${monthClass}`}
                  to={routeForMode(`/daily/${event.id}`, mode)}
                  state={{ returnTo: routeForMode('/daily', mode), returnLabel: isAnniversaryMode ? '紀念日' : isNotesMode ? 'Notes' : 'Timeline' }}
                  key={event.id}
                  data-event-id={event.id}
                  onClick={() => saveListPosition(routeForMode('/daily', mode), event.id)}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      {isAnniversaryMode ? (
                        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                          isLunar ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {isLunar ? <Moon size={11} /> : <Sun size={11} />}
                          {isLunar ? (lunarText ?? '農曆') : `國曆 ${formatSolarMonthDay(event.date)}`}
                        </span>
                      ) : isNotesMode ? (
                        <div className="flex items-center gap-1.5">
                          <time className={isTodo ? "event-date-todo" : "event-date"} dateTime={noteUpdatedAt(event)}>
                            修改於 {new Date(noteUpdatedAt(event)).toLocaleDateString('zh-TW')}
                          </time>
                          {isTodo && (
                            <span className="event-todo-badge">
                              待做
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <time className={isFuture ? "event-date-future" : "event-date"} dateTime={event.date}>
                            {event.date}
                          </time>
                          {isFuture && (
                            <span className="event-future-badge">
                              未來
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <h3 className={isTodo ? "event-title event-title-todo" : isFuture ? "event-title event-title-future" : "event-title"}><LinkifiedText text={event.title} /></h3>
                  </div>

                  <span className="flex items-center gap-2">
                    <span className={isTodo ? "event-category event-category-todo" : isFuture ? "event-category event-category-future" : "event-category"}>{event.category}</span>
                    <ChevronRight size={16} className={isTodo ? "text-rose-500 dark:text-rose-400" : isFuture ? "text-amber-500 dark:text-amber-400" : "text-stone-300 dark:text-stone-600"} />
                  </span>
                </Link>
              )
            })
          ) : (
            <div className="empty-timeline">
              <Inbox size={22} />
              <p>{isAnniversaryMode ? '目前還沒有紀念日，馬上在上方建立第一筆吧！' : isNotesMode ? '目前還沒有記事' : '目前還沒有事件'}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

