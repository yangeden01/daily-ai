import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, LoaderCircle } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Event } from '../../models/Event'
import { eventRepository } from '../../repositories'
import { aiParserService } from '../../services/ai'

const sortNewestFirst = (events: Event[]): Event[] =>
  [...events].sort((a, b) =>
    b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  )

const getLocalDate = (): string => {
  const now = new Date()
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localTime.toISOString().slice(0, 10)
}

export default function DailyPage() {
  const [rawText, setRawText] = useState('')
  const [events, setEvents] = useState<Event[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadEvents = useCallback(async () => {
    const items = await eventRepository.getAll()
    setEvents(sortNewestFirst(items))
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedText = rawText.trim()
    if (!normalizedText || isSaving) return

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const parsedEvent = await aiParserService.parseEvent(normalizedText)
      const timestamp = new Date().toISOString()
      const newEvent: Event = {
        id: crypto.randomUUID(),
        date: getLocalDate(),
        title: parsedEvent.title,
        detail: parsedEvent.rawText,
        category: parsedEvent.category,
        ...(parsedEvent.amount !== undefined ? { amount: parsedEvent.amount } : {}),
        tags: [...parsedEvent.tags],
        attachmentIds: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      await eventRepository.add(newEvent)
      await loadEvents()
      setRawText('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '事件儲存失敗')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="page-enter">
      <form onSubmit={handleSubmit}>
        <label className="section-label block" htmlFor="daily-event">新增事件</label>
        <section className="editor-card">
          <textarea
            id="daily-event"
            className="create-event-textarea"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder={'今天發生什麼事？\n\n例如：\n今天跟 Dell VP 討論 Volta EVT 延一週。'}
          />
        </section>

        {errorMessage && <p className="error-notice" role="alert">{errorMessage}</p>}

        <button type="submit" className="primary-button" disabled={!rawText.trim() || isSaving}>
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
          {events.map((event) => (
            <Link className="event-row event-row-link" to={`/daily/${event.id}`} key={event.id}>
              <time className="event-date" dateTime={event.date}>{event.date}</time>
              <h3 className="event-title">{event.title}</h3>
              <span className="flex items-center gap-2">
                <span className="event-category">{event.category}</span>
                <ChevronRight size={16} className="text-stone-300 dark:text-stone-600" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
