export type IndentDirection = 'increase' | 'decrease'

export interface TextIndentResult {
  value: string
  selectionStart: number
  selectionEnd: number
}

const addIndent = (line: string) => `  ${line}`

const removeIndent = (line: string) => {
  if (line.startsWith('\t')) return line.slice(1)
  return line.replace(/^ {1,2}/, '')
}

export const updateTextIndent = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  direction: IndentDirection,
): TextIndentResult => {
  const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1
  const effectiveEnd = selectionEnd > lineStart && value[selectionEnd - 1] === '\n'
    ? selectionEnd - 1
    : selectionEnd
  const nextLineBreak = value.indexOf('\n', effectiveEnd)
  const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak
  const selectedLines = value.slice(lineStart, lineEnd)
  const transform = direction === 'increase' ? addIndent : removeIndent
  const transformedLines = selectedLines.split('\n').map(transform).join('\n')
  const nextValue = `${value.slice(0, lineStart)}${transformedLines}${value.slice(lineEnd)}`
  const firstLineDelta = transform(selectedLines.split('\n')[0]).length - selectedLines.split('\n')[0].length
  const totalDelta = transformedLines.length - selectedLines.length

  if (selectionStart === selectionEnd) {
    const caret = Math.max(lineStart, selectionStart + firstLineDelta)
    return { value: nextValue, selectionStart: caret, selectionEnd: caret }
  }

  return {
    value: nextValue,
    selectionStart: Math.max(lineStart, selectionStart + firstLineDelta),
    selectionEnd: Math.max(lineStart, selectionEnd + totalDelta),
  }
}
