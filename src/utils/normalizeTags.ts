export const normalizeTags = (tags: string[]): string[] => {
  const seen = new Set<string>()

  return tags.reduce<string[]>((normalized, tag) => {
    const value = tag.trim()
    const key = value.toLocaleLowerCase()
    if (!value || seen.has(key)) return normalized
    seen.add(key)
    normalized.push(value)
    return normalized
  }, [])
}
