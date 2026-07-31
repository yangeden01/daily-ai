export interface TabDestination {
  pathname: string
  search: string
  state: { returnTo?: string; returnLabel?: string } | null
}

const destinations = new Map<string, TabDestination>()

export const tabBaseForReturnTo = (returnTo?: string): '/ai' | '/dashboard' | '/daily' => {
  if (returnTo?.startsWith('/ai')) return '/ai'
  if (returnTo?.startsWith('/dashboard')) return '/dashboard'
  return '/daily'
}

export const rememberTabDestination = (tabBase: string, destination: TabDestination): void => {
  destinations.set(tabBase, { ...destination, state: destination.state ? { ...destination.state } : null })
}

export const getTabDestination = (tabBase: string): TabDestination | null => destinations.get(tabBase) ?? null

export const clearTabDestination = (tabBase: string): void => {
  destinations.delete(tabBase)
}
