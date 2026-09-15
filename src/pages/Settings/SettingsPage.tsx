import { useRef, useState, type ChangeEvent } from 'react'
import { ArchiveRestore, Check, Copy, Database, Download, FolderCheck, GitMerge, Images, Info, LoaderCircle, Palette, RefreshCw, Share2, Trash2, Type, X } from 'lucide-react'
import { usePWA } from '../../contexts/PWAContext'
import { useAppearance } from '../../contexts/AppearanceContext'
import type { BackgroundTheme, TextTheme } from '../../utils/appearance'
import { loadPhotoStorageMode, savePhotoStorageMode, type PhotoStorageMode } from '../../utils/photoStorage'
import { APP_VERSION } from '../../version'
import { saveFile, shareExportedFile, type FileSaveOutcome } from '../../utils/fileSaver'

type BackupStatus = 'idle' | 'working' | 'success' | 'error'
type BackupAction = 'export' | 'merge' | 'replace'
type UpdateCheckStatus = 'idle' | 'checking' | 'applying' | 'current' | 'available' | 'offline' | 'unsupported' | 'error'

export default function SettingsPage() {
  const fullBackupInputRef = useRef<HTMLInputElement>(null)
  const fullMergeInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<BackupStatus>('idle')
  const [selectedBackupAction, setSelectedBackupAction] = useState<BackupAction>('export')
  const [message, setMessage] = useState<string | null>(null)
  const [exportNotice, setExportNotice] = useState<FileSaveOutcome | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [photoStorageMode, setPhotoStorageMode] = useState<PhotoStorageMode>(loadPhotoStorageMode)
  const [updateCheckStatus, setUpdateCheckStatus] = useState<UpdateCheckStatus>('idle')
  const [isForceReloading, setIsForceReloading] = useState(false)
  const { updateAvailable, applyUpdate, checkForUpdate } = usePWA()
  const { background, text, setBackground, setText } = useAppearance()

  const backgroundOptions: Array<{ value: BackgroundTheme; label: string; swatch: string }> = [
    { value: 'system', label: '跟隨系統', swatch: 'appearance-system' },
    { value: 'light', label: '淺色', swatch: 'appearance-light' },
    { value: 'dark', label: '深色', swatch: 'appearance-dark' },
    { value: 'paper', label: '紙張', swatch: 'appearance-paper' },
  ]
  const textOptions: Array<{ value: TextTheme; label: string; sample: string }> = [
    { value: 'sans', label: '現代', sample: 'Aa 日記' },
    { value: 'serif', label: '閱讀', sample: 'Aa 日記' },
  ]

  const selectPhotoStorageMode = (mode: PhotoStorageMode) => {
    setPhotoStorageMode(mode)
    savePhotoStorageMode(mode)
  }

  const handleForceReload = async () => {
    setIsForceReloading(true)
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((r) => r.unregister()))
      }
      if ('caches' in window) {
        const cacheKeys = await window.caches.keys()
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key)))
      }
    } catch {
      // ignore
    }
    // 強制用新 query 重新導向以破除瀏覽器層級的靜態檔快取
    const base = window.location.href.split('?')[0]
    window.location.href = `${base}?v=${Date.now()}`
  }

  const handleUpdateCheck = async () => {
    if (updateAvailable || updateCheckStatus === 'available') {
      setUpdateCheckStatus('applying')
      try {
        await applyUpdate()
      } catch {
        setUpdateCheckStatus('error')
      }
      return
    }
    setUpdateCheckStatus('checking')
    setUpdateCheckStatus(await checkForUpdate())
  }

  const updateCheckLabel = updateCheckStatus === 'applying'
    ? '升級中'
    : updateAvailable || updateCheckStatus === 'available'
      ? '立即升級'
      : updateCheckStatus === 'checking' ? '檢查中' : '檢查更新'
  const updateCheckDetail = updateCheckStatus === 'applying'
    ? '正在套用新版，完成後會自動重新開啟'
    : updateAvailable || updateCheckStatus === 'available'
      ? '發現新版本'
      : updateCheckStatus === 'current' ? '目前已是最新版'
      : updateCheckStatus === 'offline' ? '離線時無法檢查'
        : updateCheckStatus === 'unsupported' ? '此瀏覽器不支援更新檢查'
          : updateCheckStatus === 'error' ? '更新檢查失敗' : null

  const handleFullExport = async () => {
    setStatus('working')
    setMessage(null)
    setExportNotice(null)
    try {
      const { fullBackupService } = await import('../../services/FullBackupService')
      const data = await fullBackupService.exportBackup()
      const now = new Date()
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const filename = `Daily-AI-Backup-${date}.zip`

      const outcome = await saveFile({
        fileName: filename,
        data,
        mimeType: 'application/zip',
        shareAfterSave: false
      })

      setStatus('success')
      setExportNotice(outcome)
      setMessage(`備份檔案已成功儲存至手機/裝置！`)
    } catch (error) {
      if (error instanceof Error && error.message === '已取消儲存檔案') {
        setStatus('idle')
        return
      }
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '完整備份匯出失敗')
    }
  }

  const handleFullImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!window.confirm(`完整還原 ${file.name} 將覆蓋目前所有事件、照片與附件，確定繼續嗎？`)) return

    setStatus('working')
    setMessage(null)
    try {
      const { fullBackupService } = await import('../../services/FullBackupService')
      const result = await fullBackupService.restoreBackup(await file.arrayBuffer())
      setStatus('success')
      setMessage(`完整還原完成：${result.eventCount} 筆事件、${result.attachmentCount} 個附件。`)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '完整備份還原失敗')
    }
  }

  const handleFullMerge = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!window.confirm(`合併 ${file.name}？既有資料會保留，並補入缺少的事件與附件。`)) return

    setStatus('working')
    setMessage(null)
    try {
      const { fullBackupService } = await import('../../services/FullBackupService')
      const result = await fullBackupService.mergeBackup(await file.arrayBuffer())
      setStatus('success')
      setMessage(`完整備份合併完成：新增 ${result.addedEvents} 筆、更新 ${result.updatedEvents} 筆事件／記事、加入 ${result.addedAttachments} 個附件；保留 ${result.skippedEvents} 筆較新或相同資料、略過 ${result.skippedAttachments} 個重複附件。`)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '完整備份合併失敗')
    }
  }

  const handleLocalDataReset = async () => {
    if (!window.confirm('這會永久刪除目前裝置上的所有事件、照片與附件。建議先匯出完整 ZIP 備份。要繼續嗎？')) return
    if (!window.confirm('最後確認：清除後無法復原，確定清除所有本機資料嗎？')) return

    setStatus('working')
    setMessage(null)
    try {
      const { localDataService } = await import('../../services/LocalDataService')
      const result = await localDataService.reset()
      setStatus('success')
      setMessage(`本機資料已清除：${result.eventCount} 筆事件、${result.attachmentCount} 個附件。`)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '本機資料清除失敗')
    }
  }

  return (
    <main className="page-enter">
      <p className="section-label">外觀</p>
      <section className="settings-card p-3.5 sm:p-4" aria-label="背景與文字設定">
        <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100"><Palette size={16} /><h2 className="text-sm font-bold">背景</h2></div>
        <div className="mt-2.5 grid grid-cols-4 gap-2">
          {backgroundOptions.map((option) => (
            <button key={option.value} type="button" className={`appearance-option ${background === option.value ? 'appearance-option-active' : ''}`} aria-pressed={background === option.value} onClick={() => setBackground(option.value)}>
              <span className={`appearance-swatch ${option.swatch}`} aria-hidden="true" />
              <span>{option.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 text-stone-900 dark:text-stone-100"><Type size={16} /><h2 className="text-sm font-bold">文字</h2></div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {textOptions.map((option) => (
            <button key={option.value} type="button" className={`appearance-text-option ${text === option.value ? 'appearance-option-active' : ''} ${option.value === 'serif' ? 'font-serif' : 'font-sans'}`} aria-pressed={text === option.value} onClick={() => setText(option.value)}>
              <strong>{option.sample}</strong><span>{option.label}</span>
            </button>
          ))}
        </div>
      </section>

      <p className="section-label mt-8">照片儲存與版本</p>
      <section className="settings-card divide-y divide-stone-100 dark:divide-white/10" aria-label="照片儲存與版本設定">
        <div className="p-3.5 sm:p-4">
          <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100">
            <Images size={16} />
            <h2 className="text-sm font-bold">照片畫質</h2>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`appearance-text-option !min-h-16 ${photoStorageMode === 'original' ? 'appearance-option-active' : ''}`}
              aria-pressed={photoStorageMode === 'original'}
              onClick={() => selectPhotoStorageMode('original')}
            >
              <span className="!text-xs"><strong className="!block !text-sm">原始畫質</strong>保留原始照片</span>
            </button>
            <button
              type="button"
              className={`appearance-text-option !min-h-16 ${photoStorageMode === 'space' ? 'appearance-option-active' : ''}`}
              aria-pressed={photoStorageMode === 'space'}
              onClick={() => selectPhotoStorageMode('space')}
            >
              <span className="!text-xs"><strong className="!block !text-sm">節省空間</strong>1920px WebP</span>
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-stone-400">只處理之後新增的照片；既有照片與一般附件不會改變。</p>
        </div>

        <div className="p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="settings-icon !h-10 !w-10 !rounded-xl">
                <Info size={19} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 whitespace-nowrap">App 版本</h2>
                  <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-700 dark:bg-white/10 dark:text-stone-300">
                    {APP_VERSION}
                  </span>
                </div>
                <p className={`mt-0.5 h-4 text-[11px] leading-4 truncate ${updateAvailable || updateCheckStatus === 'available' ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-stone-400 dark:text-stone-500'}`}>
                  {updateCheckDetail || '已是最新版本'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                className={`update-check-button !min-h-8 !px-2.5 !py-1 !text-xs ${updateAvailable || updateCheckStatus === 'available' ? 'update-check-button-ready' : ''}`}
                onClick={() => void handleUpdateCheck()}
                disabled={updateCheckStatus === 'checking' || updateCheckStatus === 'applying'}
              >
                <RefreshCw size={13} className={updateCheckStatus === 'checking' || updateCheckStatus === 'applying' ? 'animate-spin' : ''} />
                <span className="whitespace-nowrap">{updateCheckLabel}</span>
              </button>
              <button
                type="button"
                className="inline-flex !min-h-8 items-center rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-bold text-stone-600 transition hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-wait disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.05] dark:text-stone-300 whitespace-nowrap"
                title="強制清除快取並重新載入最新版本"
                disabled={isForceReloading}
                onClick={() => void handleForceReload()}
              >
                {isForceReloading ? '更新中...' : '強制更新'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <p className="section-label mt-8">Local Data</p>
      <section className="settings-card">
        <div className="settings-row">
          <span className="settings-icon"><Database size={20} /></span>
          <div className="flex-1">
            <h2 className="settings-title">IndexedDB</h2>
            <p className="settings-detail">資料保存在目前裝置</p>
          </div>
          <span className="status-badge status-ready">使用中</span>
        </div>
      </section>

      <p className="section-label mt-8">完整備份</p>
      <section className="px-1" aria-label="完整備份說明">
        <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">Daily-AI-Backup-YYYY-MM-DD.zip</h2>
        <p className="mt-1 text-sm leading-6 text-stone-500 dark:text-stone-400">完整包含所有模式（日常記事、筆記、紀念日）之事件、照片與附件；單一檔案一次性匯出、合併或還原。</p>
      </section>
      <input ref={fullBackupInputRef} aria-label="選擇完整 ZIP 備份" type="file" accept=".zip,application/zip" className="sr-only" onChange={handleFullImport} />
      <input ref={fullMergeInputRef} aria-label="選擇要合併的完整 ZIP 備份" type="file" accept=".zip,application/zip" className="sr-only" onChange={handleFullMerge} />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button type="button" className={`backup-button ${selectedBackupAction === 'export' ? 'backup-button-primary' : 'backup-button-secondary'}`} onClick={() => { setSelectedBackupAction('export'); void handleFullExport() }} disabled={status === 'working'}>
          {status === 'working' ? <LoaderCircle size={18} className="animate-spin" /> : <Download size={18} />}
          匯出完整備份
        </button>
        <button type="button" className={`backup-button ${selectedBackupAction === 'merge' ? 'backup-button-primary' : 'backup-button-secondary'}`} onClick={() => { setSelectedBackupAction('merge'); fullMergeInputRef.current?.click() }} disabled={status === 'working'}>
          <GitMerge size={18} />匯入備份（合併）
        </button>
        <button type="button" className={`backup-button ${selectedBackupAction === 'replace' ? 'backup-button-primary' : 'backup-button-secondary'}`} onClick={() => { setSelectedBackupAction('replace'); fullBackupInputRef.current?.click() }} disabled={status === 'working'}>
          <ArchiveRestore size={18} />匯入備份（覆蓋）
        </button>
      </div>

      {exportNotice && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <FolderCheck size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">備份檔案已成功儲存至手機</span>
                <span className="rounded-full bg-emerald-200/80 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-800/60 dark:text-emerald-200">
                  {exportNotice.fileSizeText}
                </span>
              </div>
              <p className="mt-1 text-xs font-mono font-medium text-emerald-800 dark:text-emerald-300 break-all">
                {exportNotice.fileName}
              </p>

              <div className="mt-2.5 rounded-xl border border-emerald-200/80 bg-white/90 p-3 text-xs text-stone-700 dark:border-emerald-800/40 dark:bg-stone-900/90 dark:text-stone-300">
                <div className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 mb-1.5">
                  <span>📁 手機儲存位置：</span>
                </div>
                <div className="font-mono text-xs bg-stone-100 dark:bg-stone-800 px-2.5 py-2 rounded-lg text-emerald-700 dark:text-emerald-300 break-all font-semibold select-all border border-stone-200 dark:border-stone-700">
                  {exportNotice.location}
                </div>
                <p className="mt-2 text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  💡 <strong>如何找到此檔案</strong>：請開啟手機的「檔案」或「檔案管理員」App，在「下載 (Download)」資料夾中即可找到。日後若要還原，點選上方的「匯入備份」並選擇此檔案即可。
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {exportNotice.base64Data && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                    onClick={() => {
                      if (exportNotice.base64Data) {
                        void shareExportedFile(exportNotice.fileName, exportNotice.base64Data, exportNotice.mimeType || 'application/zip')
                      }
                    }}
                  >
                    <Share2 size={14} />
                    分享 / 另存至其他 App (雲端硬碟、LINE等)
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm transition hover:bg-emerald-50 dark:border-emerald-700 dark:bg-stone-900 dark:text-emerald-300 dark:hover:bg-stone-800"
                  onClick={() => {
                    void navigator.clipboard.writeText(exportNotice.location)
                    setCopySuccess(true)
                    setTimeout(() => setCopySuccess(false), 2000)
                  }}
                >
                  <Copy size={14} />
                  {copySuccess ? '已複製儲存路徑！' : '複製路徑'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {message && !exportNotice && (
        <div className={status === 'error' ? 'error-notice' : 'success-notice'} role={status === 'error' ? 'alert' : 'status'}>
          {status === 'error' ? <X size={16} /> : <Check size={16} />}
          <span>{message}</span>
        </div>
      )}

      <p className="section-label mt-8">Danger Zone</p>
      <section className="px-1" aria-label="清除本機資料說明">
        <h2 className="text-base font-semibold text-red-700 dark:text-red-300">清除本機資料</h2>
        <p className="mt-1 text-sm leading-6 text-stone-500 dark:text-stone-400">永久刪除目前裝置上的所有事件、照片與附件。</p>
      </section>
      <p className="mt-3 px-1 text-xs leading-5 text-red-700 dark:text-red-300">此操作不會刪除你已下載的 Excel 或 ZIP 備份，但 App 內資料無法復原。</p>
      <button
        type="button"
        className="backup-button mt-4 w-full border border-red-300 bg-white text-red-700 hover:bg-red-50 focus-visible:ring-red-500 dark:border-red-800 dark:bg-stone-900 dark:text-red-300 dark:hover:bg-red-950/40"
        onClick={() => void handleLocalDataReset()}
        disabled={status === 'working'}
      >
        {status === 'working' ? <LoaderCircle size={18} className="animate-spin" /> : <Trash2 size={18} />}
        清除所有本機資料
      </button>

    </main>
  )
}
