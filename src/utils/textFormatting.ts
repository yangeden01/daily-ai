import { updateTextIndent, type TextIndentResult } from './textIndent'

export type ListFormat = 'ordered' | 'bullet' | 'todo'
export type ListEditingKey = 'Enter' | 'Backspace' | 'Tab'

const LIST_LINE = /^(\s*)(?:(\d+)\.|([•*-])|([☐☑☒])|(- \[[ xX]\]))(?:[ \t]+|$)(.*)$/u

interface ParsedListLine {
  indent: string
  format: ListFormat
  content: string
  number?: number
  prefixLength: number
}

const parseListLine = (line: string): ParsedListLine | null => {
  const match = line.match(LIST_LINE)
  if (!match) return null
  const content = match[6] ?? ''
  return {
    indent: match[1],
    format: match[2] ? 'ordered' : match[4] || match[5] ? 'todo' : 'bullet',
    content,
    number: match[2] ? Number(match[2]) : undefined,
    prefixLength: line.length - content.length,
  }
}

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

const prefixFor = (format: ListFormat, index = 0) => {
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
  const nonEmptyLines = lines.filter((line) => line.trim())
  const shouldRemove = nonEmptyLines.length > 0
    && nonEmptyLines.every((line) => parseListLine(line)?.format === format)
  let orderedIndex = 0

  const transformed = lines.map((line) => {
    const parsed = parseListLine(line)
    if (!line.trim()) {
      return isCollapsed && lines.length === 1 && !shouldRemove ? prefixFor(format) : line
    }
    const indent = parsed?.indent ?? line.match(/^\s*/u)?.[0] ?? ''
    const content = parsed?.content ?? line.slice(indent.length)
    if (shouldRemove) return `${indent}${content}`
    const prefix = prefixFor(format, orderedIndex)
    if (format === 'ordered') orderedIndex += 1
    return `${indent}${prefix}${content}`
  }).join('\n')
  const nextValue = `${value.slice(0, lineStart)}${transformed}${value.slice(lineEnd)}`
  const delta = transformed.length - source.length

  return {
    value: nextValue,
    selectionStart: isCollapsed ? lineStart + transformed.length : lineStart,
    selectionEnd: isCollapsed ? lineStart + transformed.length : selectionEnd + delta,
  }
}

const continueListOnEnter = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextIndentResult | null => {
  if (selectionStart !== selectionEnd) return null
  const { lineStart, lineEnd } = getLineRange(value, selectionStart, selectionEnd)
  const line = value.slice(lineStart, lineEnd)
  const parsed = parseListLine(line)
  if (!parsed || selectionStart < lineStart + parsed.prefixLength) return null

  if (!parsed.content.trim()) {
    const nextIndent = parsed.indent.slice(0, Math.max(0, parsed.indent.length - 2))
    const replacement = parsed.indent
      ? `${nextIndent}${prefixFor(parsed.format, (parsed.number ?? 1) - 1)}`
      : ''
    const caret = lineStart + replacement.length
    return {
      value: `${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`,
      selectionStart: caret,
      selectionEnd: caret,
    }
  }

  const prefix = parsed.format === 'ordered'
    ? `${(parsed.number ?? 0) + 1}. `
    : prefixFor(parsed.format)
  const insertion = `\n${parsed.indent}${prefix}`
  const caret = selectionStart + insertion.length
  return {
    value: `${value.slice(0, selectionStart)}${insertion}${value.slice(selectionEnd)}`,
    selectionStart: caret,
    selectionEnd: caret,
  }
}

const handleListBackspace = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
): TextIndentResult | null => {
  if (selectionStart !== selectionEnd) return null
  const { lineStart, lineEnd } = getLineRange(value, selectionStart, selectionEnd)
  const line = value.slice(lineStart, lineEnd)
  const parsed = parseListLine(line)
  if (!parsed || selectionStart !== lineStart + parsed.prefixLength) return null

  if (parsed.indent) {
    const removed = Math.min(2, parsed.indent.length)
    return {
      value: `${value.slice(0, lineStart)}${line.slice(removed)}${value.slice(lineEnd)}`,
      selectionStart: selectionStart - removed,
      selectionEnd: selectionStart - removed,
    }
  }

  return {
    value: `${value.slice(0, lineStart)}${parsed.content}${value.slice(lineEnd)}`,
    selectionStart: lineStart,
    selectionEnd: lineStart,
  }
}

const handleListTab = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  decrease: boolean,
): TextIndentResult | null => {
  const { lineStart, lineEnd } = getLineRange(value, selectionStart, selectionEnd)
  const lines = value.slice(lineStart, lineEnd).split('\n').filter((line) => line.trim())
  if (!lines.length || lines.some((line) => !parseListLine(line))) return null
  const result = updateTextIndent(value, selectionStart, selectionEnd, decrease ? 'decrease' : 'increase')
  if (selectionStart !== selectionEnd) return result
  const delta = result.value.length - value.length
  return {
    ...result,
    selectionStart: selectionStart + delta,
    selectionEnd: selectionStart + delta,
  }
}

export const handleListEditingKey = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  key: ListEditingKey,
  shiftKey = false,
): TextIndentResult | null => {
  if (key === 'Enter') return shiftKey ? null : continueListOnEnter(value, selectionStart, selectionEnd)
  if (key === 'Backspace') return handleListBackspace(value, selectionStart, selectionEnd)
  return handleListTab(value, selectionStart, selectionEnd, shiftKey)
}

export interface TodoLine {
  checked: boolean
  content: string
  indent: string
  marker: 'unicode' | 'markdown'
}

export const parseTodoLine = (line: string): TodoLine | null => {
  const match = line.match(/^(\s*)(?:(☐|☑|☒)|- \[([ xX])\])(?:[ \t]+|$)(.*)$/u)
  if (!match) return null

  return {
    indent: match[1],
    checked: match[2] === '☑' || match[2] === '☒' || match[3]?.toLowerCase() === 'x',
    marker: match[2] ? 'unicode' : 'markdown',
    content: match[4],
  }
}

export const toggleTodoLineAt = (value: string, lineIndex: number): string => {
  const lines = value.split('\n')
  const line = lines[lineIndex]
  if (line === undefined) return value

  const todo = parseTodoLine(line)
  if (!todo) return value

  const marker = todo.marker === 'unicode'
    ? (todo.checked ? '☐' : '☑')
    : (todo.checked ? '- [ ]' : '- [x]')
  lines[lineIndex] = `${todo.indent}${marker}${todo.content ? ` ${todo.content}` : ''}`
  return lines.join('\n')
}

export { continueListOnEnter }
