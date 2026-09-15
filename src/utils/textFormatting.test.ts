import { describe, expect, it } from 'vitest'
import { handleListEditingKey, updateListFormat } from './textFormatting'

describe('OneNote-style text list formatting', () => {
  it('creates and converts lists', () => {
    expect(updateListFormat('one\ntwo', 0, 7, 'ordered').value).toBe('1. one\n2. two')
    expect(updateListFormat('• one\n• two', 0, 11, 'ordered').value).toBe('1. one\n2. two')
    expect(updateListFormat('one', 0, 0, 'todo').value).toBe('☐ one')
  })

  it('clicking the active list format removes it instead of checking a todo', () => {
    expect(updateListFormat('• one', 5, 5, 'bullet').value).toBe('one')
    expect(updateListFormat('☐ one', 5, 5, 'todo').value).toBe('one')
    expect(updateListFormat('☑ done', 6, 6, 'todo').value).toBe('done')
  })

  it('continues numbered, bullet, and todo lists', () => {
    expect(handleListEditingKey('2. second', 9, 9, 'Enter')?.value).toBe('2. second\n3. ')
    expect(handleListEditingKey('• item', 6, 6, 'Enter')?.value).toBe('• item\n• ')
    expect(handleListEditingKey('☑ done', 6, 6, 'Enter')?.value).toBe('☑ done\n☐ ')
  })

  it('splits a list item and keeps the current mode', () => {
    expect(handleListEditingKey('1. one two', 6, 6, 'Enter')?.value).toBe('1. one\n2.  two')
  })

  it('exits a top-level empty list item and outdents a nested empty item', () => {
    expect(handleListEditingKey('• ', 2, 2, 'Enter')).toEqual({ value: '', selectionStart: 0, selectionEnd: 0 })
    expect(handleListEditingKey('  • ', 4, 4, 'Enter')).toEqual({ value: '• ', selectionStart: 2, selectionEnd: 2 })
  })

  it('Backspace removes a top-level marker or outdents a nested item', () => {
    expect(handleListEditingKey('• item', 2, 2, 'Backspace')).toEqual({ value: 'item', selectionStart: 0, selectionEnd: 0 })
    expect(handleListEditingKey('  • item', 4, 4, 'Backspace')).toEqual({ value: '• item', selectionStart: 2, selectionEnd: 2 })
  })

  it('Tab and Shift+Tab change hierarchy only on list lines', () => {
    expect(handleListEditingKey('• item', 6, 6, 'Tab')).toEqual({ value: '  • item', selectionStart: 8, selectionEnd: 8 })
    expect(handleListEditingKey('  • item', 8, 8, 'Tab', true)).toEqual({ value: '• item', selectionStart: 6, selectionEnd: 6 })
    expect(handleListEditingKey('plain', 5, 5, 'Tab')).toBeNull()
  })

  it('Shift+Enter remains a normal line break for the textarea', () => {
    expect(handleListEditingKey('• item', 6, 6, 'Enter', true)).toBeNull()
  })
})
