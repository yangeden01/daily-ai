export interface LinkifiedTextPart {
  type: 'text' | 'link'
  value: string
  href?: string
}

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/giu
const TRAILING_PUNCTUATION = /[.,;:!?，。；：！？、)\]}）】》」』]+$/u

export const linkifyText = (text: string): LinkifiedTextPart[] => {
  const parts: LinkifiedTextPart[] = []
  let cursor = 0

  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0
    const candidate = match[0]
    const trailing = candidate.match(TRAILING_PUNCTUATION)?.[0] ?? ''
    const url = trailing ? candidate.slice(0, -trailing.length) : candidate
    if (!url) continue

    if (index > cursor) parts.push({ type: 'text', value: text.slice(cursor, index) })
    parts.push({
      type: 'link',
      value: url,
      href: url.toLowerCase().startsWith('www.') ? `https://${url}` : url,
    })
    if (trailing) parts.push({ type: 'text', value: trailing })
    cursor = index + candidate.length
  }

  if (cursor < text.length) parts.push({ type: 'text', value: text.slice(cursor) })
  return parts.length > 0 ? parts : [{ type: 'text', value: text }]
}
