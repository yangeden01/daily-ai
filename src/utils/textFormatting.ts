import type { TextIndentResult } from './textIndent'

export type ListFormat = 'ordered' | 'bullet' | 'todo'

const LIST_PREFIX = /^(\s*)(?:(?:\d+\.)|(?:[•*-])|(?:☐|☑|☒)|(?:- \[[ xX]\]))\s*/u

const getLineRange = (value: string, selectionStart: number, selectionEnd: number) => {
  const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1
  const effectiveEnd = selectionEnd > lineStart && value[selectionEnd - 1] === '\n'
    ? selectionEnd - 1
    : selectionEnd
  const nextLineBreak = value.indexOf('\n', effectiveEnd)
  return {
    lineStart,
    lineEnd: nextLineBreak === -1 ? value.length : nextLineBreak,
  }
}

const prefixFor = (format: ListFormat, index: number) => {
  if (format === 'ordered') return `${index + 1}. `
  if (format === 'todo') return '☐ '
  return '• '
}

export const updateListFormat = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  format: ListFormat,
): TextIndentResult => {
  const isCollapsed = selectionStart === selectionEnd
  const { lineStart, lineEnd } = getLineRange(value, selectionStart, selectionEnd)
  const source = value.slice(lineStart, lineEnd)
  const lines = source.split('\n')
  const transformed = lines.map((line, index) => {
    if (!line.trim()) return line
    const indent = line.match(/^\s*/u)?.[0] ?? ''

    if (format === 'todo') {
      const existingTodo = line.match(/^(\s*)([☐☑☒])\s*/u)
      if (existingTodo) {
        const marker = existingTodo[2] === '☐' ? '☑' : '☐'
        return `${existingTodo[1]}${marker} ${line.slice(existingTodo[0].length)}`
      }
    }

    const content = line.replace(LIST_PREFIX, '').trimStart()
    return `${indent}${prefixFor(format, index)}${content}`
  }).join('\n')
  const nextValue = `${value.slice(0, lineStart)}${transformed}${value.slice(lineEnd)}`
  const delta = transformed.length - source.length

  return {
    value: nextValue,
    selectionStart: isCollapsed ? lineStart + transformed.length : lineStart,
    selectionEnd: isCollapsed ? lineStart + transformed.length : selectionEnd + delta,
  }
}

export const continueListOnEnter = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextIndentResult | null => {
  if (selectionStart !== selectionEnd) return null

  const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1
  const lineBeforeCaret = value.slice(lineStart, selectionStart)
  const match = lineBeforeCaret.match(/^(\s*)(?:(\d+)\.|([•*-])|([☐☑☒])|(- \[[ xX]\]))\s+/u)
  if (!match) return null

  const prefix = match[2]
    ? `${Number(match[2]) + 1}. `
    : match[4] || match[5]
      ? '☐ '
      : '• '
  const insertion = `\n${match[1]}${prefix}`
  const caret = selectionStart + insertion.length

  return {
    value: `${value.slice(0, selectionStart)}${insertion}${value.slice(selectionEnd)}`,
    selectionStart: caret,
    selectionEnd: caret,
  }
}
