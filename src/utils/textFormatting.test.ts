import { describe, expect, it } from 'vitest'
import { continueListOnEnter, updateListFormat } from './textFormatting'

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

  it('places the caret at the end after applying a list format', () => {
    expect(updateListFormat('hello', 5, 5, 'ordered')).toEqual({
      value: '1. hello',
      selectionStart: 8,
      selectionEnd: 8,
    })
  })

  it('continues numbered lists and increments their number', () => {
    expect(continueListOnEnter('2. second', 9, 9)).toEqual({
      value: '2. second\n3. ',
      selectionStart: 13,
      selectionEnd: 13,
    })
  })

  it('continues bullet and todo lists', () => {
    expect(continueListOnEnter('• item', 6, 6)).toEqual({
      value: '• item\n• ',
      selectionStart: 9,
      selectionEnd: 9,
    })
    expect(continueListOnEnter('☑ done', 6, 6)).toEqual({
      value: '☑ done\n☐ ',
      selectionStart: 9,
      selectionEnd: 9,
    })
  })

})
