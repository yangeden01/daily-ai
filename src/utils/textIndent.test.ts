import { describe, expect, it } from 'vitest'
import { updateTextIndent } from './textIndent'

describe('updateTextIndent', () => {
  it('increases indentation on the current line', () => {
    expect(updateTextIndent('first\nsecond', 8, 8, 'increase')).toEqual({
      value: 'first\n  second',
      selectionStart: 10,
      selectionEnd: 10,
    })
  })

  it('increases indentation on multiple selected lines', () => {
    expect(updateTextIndent('first\nsecond\nthird', 0, 12, 'increase')).toEqual({
      value: '  first\n  second\nthird',
      selectionStart: 2,
      selectionEnd: 16,
    })
  })

  it('removes a tab or up to two leading spaces', () => {
    expect(updateTextIndent('  first\n\tsecond', 0, 15, 'decrease').value).toBe('first\nsecond')
  })

  it('leaves an unindented line unchanged', () => {
    expect(updateTextIndent('first', 2, 2, 'decrease')).toEqual({
      value: 'first',
      selectionStart: 2,
      selectionEnd: 2,
    })
  })
})
