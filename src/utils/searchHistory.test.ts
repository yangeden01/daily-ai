import { describe, expect, it } from 'vitest'
import { addSearchHistory } from './searchHistory'

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
})
