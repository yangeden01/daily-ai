export type AppMode = 'daily' | 'notes'

export const appModeFromSearch = (search: string): AppMode =>
  new URLSearchParams(search).get('mode') === 'notes' ? 'notes' : 'daily'

export const searchForMode = (mode: AppMode, currentSearch = ''): string => {
  const params = new URLSearchParams(currentSearch)
  if (mode === 'notes') params.set('mode', 'notes')
  else params.delete('mode')
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const routeForMode = (pathname: string, mode: AppMode, currentSearch = ''): string =>
  `${pathname}${searchForMode(mode, currentSearch)}`
