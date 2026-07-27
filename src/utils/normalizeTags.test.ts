import { describe, expect, it } from 'vitest'
import { normalizeTags } from './normalizeTags'

describe('normalizeTags', () => {
  it('trims tags and removes empty and case-insensitive duplicates', () => {
    expect(normalizeTags([' 工作 ', '', '旅行', '工作', '  ', 'TRAVEL', 'travel']))
      .toEqual(['工作', '旅行', 'TRAVEL'])
  })
})
