import { IndentDecrease, IndentIncrease, List, ListChecks, ListOrdered } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { updateListFormat, type ListFormat } from '../../utils/textFormatting'
import { updateTextIndent, type IndentDirection } from '../../utils/textIndent'

interface EditorIndentToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (value: string) => void
  trailing?: ReactNode
}

export const EditorIndentToolbar = ({ textareaRef, value, onChange, trailing }: EditorIndentToolbarProps) => {
  const applyResult = (result: ReturnType<typeof updateTextIndent>) => {
    const textarea = textareaRef.current
    if (!textarea) return
    onChange(result.value)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  const applyIndent = (direction: IndentDirection) => {
    const textarea = textareaRef.current
    if (!textarea) return
    applyResult(updateTextIndent(value, textarea.selectionStart, textarea.selectionEnd, direction))
  }

  const applyList = (format: ListFormat) => {
    const textarea = textareaRef.current
    if (!textarea) return
    applyResult(updateListFormat(value, textarea.selectionStart, textarea.selectionEnd, format))
  }

  const tools = [
    { label: '編號清單', icon: ListOrdered, action: () => applyList('ordered') },
    { label: '項目符號', icon: List, action: () => applyList('bullet') },
    { label: '待辦清單', icon: ListChecks, action: () => applyList('todo') },
    { label: '增加縮排', icon: IndentIncrease, action: () => applyIndent('increase') },
    { label: '減少縮排', icon: IndentDecrease, action: () => applyIndent('decrease') },
  ]

  return (
    <div className="text-indent-toolbar" aria-label="文字格式工具">
      {tools.map(({ label, icon: Icon, action }) => (
        <button
          aria-label={label}
          key={label}
          onClick={action}
          onMouseDown={(event) => event.preventDefault()}
          title={label}
          type="button"
        >
          <Icon aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
      {trailing}
    </div>
  )
}
