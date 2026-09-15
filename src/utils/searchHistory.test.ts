import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addSearchHistory, loadSearchHistory, saveSearchHistory } from './searchHistory'

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  } satisfies Storage)
})

describe('addSearchHistory', () => {
  it('keeps the five newest unique searches', () => {
    const history = ['五', '四', '三', '二', '一']

    expect(addSearchHistory(history, '六')).toEqual(['六', '五', '四', '三', '二'])
    expect(addSearchHistory(history, '三')).toEqual(['三', '五', '四', '二', '一'])
  })

  it('trims input and ignores blank searches', () => {
    expect(addSearchHistory(['所得稅'], '  家庭旅遊  ')).toEqual(['家庭旅遊', '所得稅'])
    expect(addSearchHistory(['所得稅'], '   ')).toEqual(['所得稅'])
  })

  it('keeps Daily and Notes search histories separate', () => {
    saveSearchHistory(['所得稅'], 'daily')
    saveSearchHistory(['行李檢查表'], 'notes')

    expect(loadSearchHistory('daily')).toEqual(['所得稅'])
    expect(loadSearchHistory('notes')).toEqual(['行李檢查表'])
  })
})
