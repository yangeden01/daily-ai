import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Check, LoaderCircle, Pencil, Trash2, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Event } from '../../models/Event'
import { eventRepository } from '../../repositories'
import { aiParserService } from '../../services/ai'

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
  const [event, setEvent] = useState<Event | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [category, setCategory] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId) return
    eventRepository.getById(eventId).then((item) => {
      setEvent(item ?? null)
      setIsLoading(false)
    })
  }, [eventId])

  const startEditing = () => {
    if (!event) return
    setTitle(event.title)
    setDetail(event.detail)
    setCategory(event.category)
    setErrorMessage(null)
    setIsEditing(true)
  }

  const handleSave = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault()
    if (!event || !title.trim() || !detail.trim() || !category.trim() || isSaving) return

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const parsed = await aiParserService.parseEvent(detail)
      await eventRepository.update(event.id, {
        ...event,
        title: title.trim(),
        detail: detail.trim(),
        category: category.trim(),
        tags: [...parsed.tags],
        updatedAt: new Date().toISOString(),
      })
      navigate('/daily')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '事件更新失敗')
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!event || isDeleting) return
    const confirmed = window.confirm(`確定要刪除「${event.title}」嗎？\n\n此動作無法復原。`)
    if (!confirmed) return

    setIsDeleting(true)
    setErrorMessage(null)

    try {
      await eventRepository.delete(event.id)
      navigate('/daily', { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '事件刪除失敗')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return <main className="detail-state"><LoaderCircle className="animate-spin" size={24} /><span>載入事件</span></main>
  }

  if (!event) {
    return <main className="detail-state"><p>找不到這筆事件。</p><Link to="/daily" className="detail-back-link">返回 Timeline</Link></main>
  }

  return (
    <main className="page-enter">
      <div className="mb-5 flex items-center justify-between">
        <Link to="/daily" className="detail-back-link"><ArrowLeft size={17} />Timeline</Link>
        {!isEditing && <button type="button" className="edit-button" onClick={startEditing}><Pencil size={16} />Edit</button>}
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="detail-card p-5 sm:p-6">
          <label className="detail-field-label" htmlFor="event-title">Title</label>
          <input id="event-title" className="detail-input" value={title} onChange={(inputEvent) => setTitle(inputEvent.target.value)} />

          <label className="detail-field-label mt-5" htmlFor="event-detail">Detail</label>
          <textarea id="event-detail" className="detail-input min-h-40 resize-y" value={detail} onChange={(inputEvent) => setDetail(inputEvent.target.value)} />

          <label className="detail-field-label mt-5" htmlFor="event-category">Category</label>
          <input id="event-category" className="detail-input" value={category} onChange={(inputEvent) => setCategory(inputEvent.target.value)} />

          <p className="mt-4 text-xs leading-5 text-stone-400">儲存時會依照 Detail 重新產生 Tags。</p>
          {errorMessage && <p className="error-notice" role="alert">{errorMessage}</p>}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" className="detail-secondary-button" onClick={() => setIsEditing(false)} disabled={isSaving}><X size={17} />取消</button>
            <button type="submit" className="detail-save-button" disabled={!title.trim() || !detail.trim() || !category.trim() || isSaving}>
              {isSaving ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}
              儲存
            </button>
          </div>
        </form>
      ) : (
        <>
          <section className="detail-card">
            <div className="border-b border-stone-100 p-5 dark:border-white/10 sm:p-6">
              <time className="event-date !col-span-1" dateTime={event.date}>{event.date}</time>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-stone-950 dark:text-white">{event.title}</h2>
              <span className="event-category mt-3 inline-block">{event.category}</span>
            </div>

            <div className="p-5 sm:p-6">
              <p className="detail-label">Detail</p>
              <p className="whitespace-pre-wrap text-[15px] leading-7 text-stone-700 dark:text-stone-300">{event.detail}</p>

              <p className="detail-label mt-7">Tags</p>
              <div className="flex flex-wrap gap-2">
                {event.tags.length > 0 ? event.tags.map((tag) => <span className="tag-chip" key={tag}>{tag}</span>) : <span className="text-sm text-stone-400">No tags</span>}
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <div className="metric-card"><span>Attachments</span><strong>{event.attachmentIds.length}</strong></div>
                <div className="metric-card"><span>Photos</span><strong>0</strong></div>
              </div>
            </div>

            <dl className="detail-meta">
              <div><dt>Created</dt><dd>{formatDateTime(event.createdAt)}</dd></div>
              <div><dt>Updated</dt><dd>{formatDateTime(event.updatedAt)}</dd></div>
            </dl>
          </section>

          {errorMessage && <p className="error-notice" role="alert">{errorMessage}</p>}
          <button type="button" className="delete-event-button" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <LoaderCircle size={18} className="animate-spin" /> : <Trash2 size={18} />}
            {isDeleting ? '刪除中' : '刪除事件'}
          </button>
        </>
      )}
    </main>
  )
}
