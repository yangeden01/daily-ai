import { Camera, FilePlus2, Images, Paperclip } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEventHandler } from 'react'

interface AttachmentPickerProps {
  count?: number
  isProcessing?: boolean
  onSelectFiles: ChangeEventHandler<HTMLInputElement>
}

export const AttachmentPicker = ({ count = 0, isProcessing = false, onSelectFiles }: AttachmentPickerProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  const choose = (input: HTMLInputElement | null) => {
    setIsOpen(false)
    input?.click()
  }

  return (
    <div className="attachment-picker" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={count > 0 ? `加入照片或附件，目前 ${count} 個檔案` : '加入照片或附件'}
        className="attachment-picker-trigger"
        disabled={isProcessing}
        onClick={() => setIsOpen((open) => !open)}
        title="加入照片或附件"
        type="button"
      >
        <Paperclip aria-hidden="true" />
        {count > 0 && <span className="attachment-picker-count">{count}</span>}
      </button>

      {isOpen && (
        <div aria-label="加入內容" className="attachment-picker-menu" role="menu">
          <button onClick={() => choose(cameraInputRef.current)} role="menuitem" type="button">
            <Camera aria-hidden="true" />拍照
          </button>
          <button onClick={() => choose(photoInputRef.current)} role="menuitem" type="button">
            <Images aria-hidden="true" />相片
          </button>
          <button onClick={() => choose(fileInputRef.current)} role="menuitem" type="button">
            <FilePlus2 aria-hidden="true" />附檔
          </button>
        </div>
      )}

      <input ref={cameraInputRef} aria-label="拍照" className="sr-only" type="file" accept="image/*" capture="environment" onChange={onSelectFiles} />
      <input ref={photoInputRef} aria-label="選擇相片" className="sr-only" type="file" accept="image/*" multiple onChange={onSelectFiles} />
      <input ref={fileInputRef} aria-label="選擇附檔" className="sr-only" type="file" multiple onChange={onSelectFiles} />
    </div>
  )
}
