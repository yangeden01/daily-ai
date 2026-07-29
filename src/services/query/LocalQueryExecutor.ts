import type { Event } from '../../models/Event'
import type { EventQueryResult, ParsedEventQuery } from '../../models/EventQuery'
import type { EventRepository } from '../../repositories/EventRepository'
import type { AttachmentRepository } from '../../repositories/AttachmentRepository'

const normalized = (value: string): string => value.trim().toLocaleLowerCase()

const matches = (event: Event, query: ParsedEventQuery): boolean => {
  const { keyword, category, tag, dateFrom, dateTo } = query.criteria
  const searchable = [event.title, event.detail, event.category, ...event.tags].join(' ').toLocaleLowerCase()
  return (
    (!keyword || searchable.includes(normalized(keyword))) &&
    (!category || normalized(event.category) === normalized(category)) &&
    (!tag || event.tags.some((item) => normalized(item) === normalized(tag))) &&
    (!dateFrom || event.date >= dateFrom) &&
    (!dateTo || event.date <= dateTo)
  )
}

export class LocalQueryExecutor {
  constructor(private readonly repository: EventRepository, private readonly attachmentRepository?: AttachmentRepository) {}

  async execute(query: ParsedEventQuery): Promise<EventQueryResult> {
    const attachments = query.criteria.attachmentKind && this.attachmentRepository
      ? await this.attachmentRepository.getAll()
      : []
    const eventIdsWithPhotos = new Set(attachments.filter(({ type }) => type === 'image').map(({ eventId }) => eventId))
    const eventIdsWithFiles = new Set(attachments.filter(({ type }) => type !== 'image').map(({ eventId }) => eventId))
    const eventIdsWithAny = new Set(attachments.map(({ eventId }) => eventId))
    const matchesAttachment = (event: Event) => {
      if (!query.criteria.attachmentKind) return true
      if (query.criteria.attachmentKind === 'photo') return eventIdsWithPhotos.has(event.id)
      if (query.criteria.attachmentKind === 'file') return eventIdsWithFiles.has(event.id)
      return eventIdsWithAny.has(event.id)
    }

    const events = (await this.repository.getAll())
      .filter((event) => matches(event, query))
      .filter(matchesAttachment)
      .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))

    return {
      query,
      events,
      count: events.length,
      amountTotal: events.reduce((total, event) => total + (event.amount ?? 0), 0),
    }
  }
}
