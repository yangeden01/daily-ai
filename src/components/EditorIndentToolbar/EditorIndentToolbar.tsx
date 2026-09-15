import { IndentDecrease, IndentIncrease, List, ListChecks, ListOrdered, Redo2, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { updateListFormat, type ListFormat } from '../../utils/textFormatting'
import { updateTextIndent, type IndentDirection } from '../../utils/textIndent'

interface EditorIndentToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (value: string) => void
  trailing?: ReactNode
}

interface HistoryEntry {
  text: string
  selectionStart: number
  selectionEnd: number
}

export const EditorIndentToolbar = ({ textareaRef, value, onChange, trailing }: EditorIndentToolbarProps) => {
  const historyRef = useRef<HistoryEntry[]>([])
  const historyIndexRef = useRef<number>(-1)
  const isNavigatingHistoryRef = useRef(false)
  const lastRecordTimeRef = useRef<number>(0)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  useEffect(() => {
    if (isNavigatingHistoryRef.current) {
      isNavigatingHistoryRef.current = false
      setCanUndo(historyIndexRef.current > 0)
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
      return
    }

    const textarea = textareaRef.current
    const cursor = textarea?.selectionStart ?? value.length
    const end = textarea?.selectionEnd ?? value.length
    const now = Date.now()

    if (historyRef.current.length === 0) {
      historyRef.current = [{ text: value, selectionStart: cursor, selectionEnd: end }]
      historyIndexRef.current = 0
      lastRecordTimeRef.current = now
      setCanUndo(false)
      setCanRedo(false)
      return
    }

    const currentEntry = historyRef.current[historyIndexRef.current]
    if (currentEntry && currentEntry.text === value) {
      return
    }

    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    }

    const prevLength = currentEntry?.text.length ?? 0
    const isDeletion = value.length < prevLength
    const timeDiff = now - lastRecordTimeRef.current
    const isCleared = value === ''
    const isMajorChange = Math.abs(value.length - prevLength) > 3 || value.endsWith('\n')

    // 如果是刪除操作（誤刪、倒退鍵、選取清除），一律立即新增歷史節點，確保能完整回復剛刪除的文字
    if (isDeletion || isCleared || isMajorChange || timeDiff > 500 || historyRef.current.length <= 1) {
      historyRef.current.push({ text: value, selectionStart: cursor, selectionEnd: end })
      if (historyRef.current.length > 150) {
        historyRef.current.shift()
      }
      historyIndexRef.current = historyRef.current.length - 1
      lastRecordTimeRef.current = now
    } else {
      historyRef.current[historyIndexRef.current] = {
        text: value,
        selectionStart: cursor,
        selectionEnd: end,
      }
    }

    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
  }, [value, textareaRef])

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current--
    const target = historyRef.current[historyIndexRef.current]
    if (!target) return
    isNavigatingHistoryRef.current = true
    onChange(target.text)
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(true)
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(target.selectionStart, target.selectionEnd)
      }
    })
  }

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current++
    const target = historyRef.current[historyIndexRef.current]
    if (!target) return
    isNavigatingHistoryRef.current = true
    onChange(target.text)
    setCanUndo(true)
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
    requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(target.selectionStart, target.selectionEnd)
      }
    })
  }

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        handleRedo()
      }
    }

    textarea.addEventListener('keydown', handleKeyDown)
    return () => {
      textarea.removeEventListener('keydown', handleKeyDown)
    }
  }, [textareaRef])

  const applyResult = (result: ReturnType<typeof updateTextIndent>) => {
    const textarea = textareaRef.current
    if (!textarea) return
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    }
    historyRef.current.push({
      text: result.value,
      selectionStart: result.selectionStart,
      selectionEnd: result.selectionEnd,
    })
    if (historyRef.current.length > 50) {
      historyRef.current.shift()
    }
    historyIndexRef.current = historyRef.current.length - 1
    lastRecordTimeRef.current = Date.now()
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(false)

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
    { label: '回復', icon: Undo2, action: handleUndo, disabled: !canUndo },
    { label: '重做', icon: Redo2, action: handleRedo, disabled: !canRedo },
    { label: '編號清單', icon: ListOrdered, action: () => applyList('ordered') },
    { label: '項目符號', icon: List, action: () => applyList('bullet') },
    { label: '待辦清單', icon: ListChecks, action: () => applyList('todo') },
    { label: '增加縮排', icon: IndentIncrease, action: () => applyIndent('increase') },
    { label: '減少縮排', icon: IndentDecrease, action: () => applyIndent('decrease') },
  ]

  return (
    <div className="text-indent-toolbar" aria-label="文字格式工具">
      {tools.map(({ label, icon: Icon, action, disabled }) => (
        <button
          aria-label={label}
          disabled={disabled}
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
