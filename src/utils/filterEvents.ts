import type { Event } from '../models/Event'
import type { EventSearchCriteria } from '../models/EventSearchCriteria'

export const filterEvents = (events: Event[], criteria: EventSearchCriteria): Event[] => {
  const keyword = criteria.keyword?.trim().toLocaleLowerCase() ?? ''
  const category = criteria.category?.trim().toLocaleLowerCase() ?? ''

  return events.filter((event) => {
    const searchableText = [event.title, event.detail, ...event.tags]
      .join(' ')
      .toLocaleLowerCase()

    return (
      (!keyword || searchableText.includes(keyword)) &&
      (!category || event.category.toLocaleLowerCase() === category) &&
      (!criteria.dateFrom || event.date >= criteria.dateFrom) &&
      (!criteria.dateTo || event.date <= criteria.dateTo)
    )
  })
}
