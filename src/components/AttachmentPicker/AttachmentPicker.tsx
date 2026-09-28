import { Camera, Images, Paperclip, X } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEventHandler } from 'react'

interface AttachmentPickerProps {
  count?: number
  isProcessing?: boolean
  onSelectFiles: ChangeEventHandler<HTMLInputElement>
}

export const AttachmentPicker = ({ count = 0, isProcessing = false, onSelectFiles }: AttachmentPickerProps) => {
  const [isImageSheetOpen, setIsImageSheetOpen] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isImageSheetOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsImageSheetOpen(false)
    }

    const handleDismiss = () => {
      setIsImageSheetOpen(false)
    }

    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('swiftnote:dismiss-modal', handleDismiss)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('swiftnote:dismiss-modal', handleDismiss)
    }
  }, [isImageSheetOpen])

  return (
    <div className="attachment-picker">
      {/* 圖片/相片按鈕 (Photo / Image) */}
      <button
        type="button"
        className="attachment-picker-action-btn text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
        disabled={isProcessing}
        onClick={() => setIsImageSheetOpen(true)}
        title="加入圖片 / 拍照"
        aria-label="加入圖片或拍照"
      >
        <Images aria-hidden="true" />
      </button>

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
        ref={cameraInputRef}
        aria-label="拍照"
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onSelectFiles}
      />
      <input
        ref={photoInputRef}
        aria-label="選擇相片"
        className="sr-only"
        type="file"
        accept="image/*"
        multiple
        onChange={onSelectFiles}
      />
      <input
        ref={fileInputRef}
        aria-label="選擇附檔"
        className="sr-only"
        type="file"
        multiple
        onChange={onSelectFiles}
      />

      {/* 相片/拍照選擇 Action Sheet（使用 fixed 全螢幕圖層，絕不受外層捲軸或容器裁切影響） */}
      {isImageSheetOpen && (
        <div
          data-modal-open="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsImageSheetOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl dark:bg-stone-850 dark:border dark:border-white/10 animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-white/10">
              <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-stone-100">
                <Images className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>新增圖片 / 照片</span>
              </div>
              <button
                type="button"
                onClick={() => setIsImageSheetOpen(false)}
                className="rounded-full p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-white/10"
                aria-label="關閉"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsImageSheetOpen(false)
                  cameraInputRef.current?.click()
                }}
                className="flex w-full items-center gap-3.5 rounded-xl border border-stone-200/80 bg-stone-50/80 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-300">
                  <Camera size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">開啟相機拍照</div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">使用手機相機直接拍攝照片加入記事</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsImageSheetOpen(false)
                  photoInputRef.current?.click()
                }}
                className="flex w-full items-center gap-3.5 rounded-xl border border-stone-200/80 bg-stone-50/80 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-300">
                  <Images size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">從相片圖庫選取</div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">從裝置相簿、Google 相簿中挑選多張照片</div>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsImageSheetOpen(false)}
              className="mt-3.5 w-full rounded-xl border border-stone-200 py-2.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-100 dark:border-white/10 dark:text-stone-300 dark:hover:bg-white/10"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
