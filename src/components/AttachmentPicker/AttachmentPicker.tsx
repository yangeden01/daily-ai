import { Paperclip } from 'lucide-react'
import { useRef, type ChangeEventHandler } from 'react'

interface AttachmentPickerProps {
  count?: number
  isProcessing?: boolean
  onSelectFiles: ChangeEventHandler<HTMLInputElement>
}

export const AttachmentPicker = ({ count = 0, isProcessing = false, onSelectFiles }: AttachmentPickerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="attachment-picker">
      {/* 附件/檔案按鈕 (File / Attachment) */}
      <button
        type="button"
        className="attachment-picker-action-btn"
        disabled={isProcessing}
        onClick={() => fileInputRef.current?.click()}
        title={count > 0 ? `加入檔案附件（目前 ${count} 個附件）` : '加入檔案附件'}
        aria-label={count > 0 ? `加入檔案附件，目前 ${count} 個檔案` : '加入檔案附件'}
      >
        <Paperclip aria-hidden="true" />
        {count > 0 && <span className="attachment-picker-count">{count}</span>}
      </button>

      {/* 隱藏的 input 表單元件 */}
      <input
        ref={fileInputRef}
        aria-label="選擇附檔"
        className="sr-only"
        type="file"
        multiple
        onChange={onSelectFiles}
      />
    </div>
  )
}
