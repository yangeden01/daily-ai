import { describe, expect, it } from 'vitest'
import { toggleBold, updateListFormat } from './textFormatting'

describe('text formatting', () => {
  it('creates a numbered list for selected lines', () => {
    expect(updateListFormat('one\ntwo', 0, 7, 'ordered').value).toBe('1. one\n2. two')
  })

  it('creates bullet and todo lists', () => {
    expect(updateListFormat('one', 0, 0, 'bullet').value).toBe('• one')
    expect(updateListFormat('one', 0, 0, 'todo').value).toBe('☐ one')
  })

  it('toggles a todo item between unchecked and checked', () => {
    expect(updateListFormat('☐ one', 3, 3, 'todo').value).toBe('☑ one')
    expect(updateListFormat('☑ one', 3, 3, 'todo').value).toBe('☐ one')
  })

  it('replaces an existing list marker', () => {
    expect(updateListFormat('• one\n• two', 0, 11, 'ordered').value).toBe('1. one\n2. two')
  })

  it('wraps selected text in bold markers', () => {
    expect(toggleBold('hello world', 0, 5)).toEqual({
      value: '**hello** world',
      selectionStart: 2,
      selectionEnd: 7,
    })
  })

  it('inserts bold markers around an empty caret', () => {
    expect(toggleBold('hello', 5, 5)).toEqual({
      value: 'hello****',
      selectionStart: 7,
      selectionEnd: 7,
    })
  })
})
