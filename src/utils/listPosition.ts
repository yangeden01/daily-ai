interface ListPosition {
  scrollY: number
  eventId: string
}

const storageKey = (routeKey: string) => `daily-ai.list-position:${routeKey}`

export const saveListPosition = (routeKey: string, eventId: string): void => {
  try {
    const value: ListPosition = { scrollY: window.scrollY, eventId }
    sessionStorage.setItem(storageKey(routeKey), JSON.stringify(value))
  } catch {
    // Returning still works even when session storage is unavailable.
  }
}

export const restoreListPosition = (routeKey: string): void => {
  try {
    const key = storageKey(routeKey)
    const raw = sessionStorage.getItem(key)
    if (!raw) return
    const value = JSON.parse(raw) as Partial<ListPosition>
    if (typeof value.scrollY !== 'number' || typeof value.eventId !== 'string') return
    sessionStorage.removeItem(key)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.scrollTo({ top: value.scrollY, behavior: 'auto' })
      document.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(value.eventId!)}"]`)?.focus({ preventScroll: true })
    }))
  } catch {
    // Ignore malformed or unavailable session data.
  }
}
