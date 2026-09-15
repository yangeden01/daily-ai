export type AppMode = 'daily' | 'notes' | 'anniversary'

export const appModeFromSearch = (search: string): AppMode => {
  const mode = new URLSearchParams(search).get('mode')
  if (mode === 'notes') return 'notes'
  if (mode === 'anniversary') return 'anniversary'
  return 'daily'
}

export const searchForMode = (mode: AppMode, currentSearch = ''): string => {
  const params = new URLSearchParams(currentSearch)
  if (mode === 'notes') params.set('mode', 'notes')
  else if (mode === 'anniversary') params.set('mode', 'anniversary')
  else params.delete('mode')
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const routeForMode = (pathname: string, mode: AppMode, currentSearch = ''): string =>
  `${pathname}${searchForMode(mode, currentSearch)}`
