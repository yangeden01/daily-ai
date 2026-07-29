import { useRef, useState, type ChangeEvent } from 'react'
import { ArchiveRestore, Check, Database, Download, GitMerge, Images, Info, LoaderCircle, Palette, RefreshCw, ServerCog, Share, Smartphone, Trash2, Type, Wifi, WifiOff, X } from 'lucide-react'
import { usePWA } from '../../contexts/PWAContext'
import { useAppearance } from '../../contexts/AppearanceContext'
import type { BackgroundTheme, TextTheme } from '../../utils/appearance'
import { loadPhotoStorageMode, savePhotoStorageMode, type PhotoStorageMode } from '../../utils/photoStorage'

type BackupStatus = 'idle' | 'working' | 'success' | 'error'
type BackupAction = 'export' | 'merge' | 'replace'
type UpdateCheckStatus = 'idle' | 'checking' | 'applying' | 'current' | 'available' | 'offline' | 'unsupported' | 'error'

export default function SettingsPage() {
  const fullBackupInputRef = useRef<HTMLInputElement>(null)
  const fullMergeInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<BackupStatus>('idle')
  const [selectedBackupAction, setSelectedBackupAction] = useState<BackupAction>('export')
  const [message, setMessage] = useState<string | null>(null)
  const [photoStorageMode, setPhotoStorageMode] = useState<PhotoStorageMode>(loadPhotoStorageMode)
  const [updateCheckStatus, setUpdateCheckStatus] = useState<UpdateCheckStatus>('idle')
  const { isOnline, isInstalled, isStandalone, installPlatform, canPromptInstall, showInstallExperience, serviceWorkerStatus, updateAvailable, install, applyUpdate, checkForUpdate } = usePWA()
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
    try {
      const { fullBackupService } = await import('../../services/FullBackupService')
      const data = await fullBackupService.exportBackup()
      const url = URL.createObjectURL(new Blob([data.slice().buffer], { type: 'application/zip' }))
      const now = new Date()
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const link = document.createElement('a')
      link.href = url
      link.download = `Daily-AI-Backup-${date}.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
      setStatus('success')
      setMessage('完整 ZIP 備份已匯出，包含事件、照片與附件。')
    } catch (error) {
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
      setMessage(`完整備份合併完成：新增 ${result.addedEvents} 筆事件、${result.addedAttachments} 個附件；略過 ${result.skippedEvents} 筆重複事件、${result.skippedAttachments} 個重複附件。`)
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

      <p className="section-label mt-8">照片儲存</p>
      <section className="settings-card p-3.5 sm:p-4" aria-label="照片畫質設定">
        <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100"><Images size={16} /><h2 className="text-sm font-bold">照片畫質</h2></div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button type="button" className={`appearance-text-option !min-h-16 ${photoStorageMode === 'original' ? 'appearance-option-active' : ''}`} aria-pressed={photoStorageMode === 'original'} onClick={() => selectPhotoStorageMode('original')}>
            <span className="!text-xs"><strong className="!block !text-sm">原始畫質</strong>保留原始照片</span>
          </button>
          <button type="button" className={`appearance-text-option !min-h-16 ${photoStorageMode === 'space' ? 'appearance-option-active' : ''}`} aria-pressed={photoStorageMode === 'space'} onClick={() => selectPhotoStorageMode('space')}>
            <span className="!text-xs"><strong className="!block !text-sm">節省空間</strong>1920px WebP</span>
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-stone-400">只處理之後新增的照片；既有照片與一般附件不會改變。</p>
      </section>

      <p className="section-label mt-8">App Status</p>
      <section className="settings-card divide-y divide-stone-100 dark:divide-white/10">
        <div className="settings-row">
          <span className="settings-icon"><Info size={20} /></span>
          <div className="min-w-0 flex-1"><h2 className="settings-title">App Version</h2><p className="settings-detail">v0.1 Alpha</p>{updateCheckDetail && <p className={`mt-1 text-[10px] font-semibold ${updateAvailable || updateCheckStatus === 'available' ? 'text-indigo-600 dark:text-indigo-300' : 'text-stone-400'}`}>{updateCheckDetail}</p>}</div>
          <button type="button" className={`update-check-button ${updateAvailable || updateCheckStatus === 'available' ? 'update-check-button-ready' : ''}`} onClick={() => void handleUpdateCheck()} disabled={updateCheckStatus === 'checking' || updateCheckStatus === 'applying'}>
            <RefreshCw size={14} className={updateCheckStatus === 'checking' || updateCheckStatus === 'applying' ? 'animate-spin' : ''} />{updateCheckLabel}
          </button>
        </div>
        <div className="settings-row">
          <span className="settings-icon"><Smartphone size={20} /></span>
          <div className="flex-1"><h2 className="settings-title">安裝狀態</h2><p className="settings-detail">{isInstalled ? (isStandalone ? '已安裝並以 App 模式執行' : '已安裝') : '尚未安裝'}</p></div>
          <span className={`status-badge ${isInstalled ? 'status-ready' : 'status-idle'}`}>{isInstalled ? 'Installed' : 'Browser'}</span>
        </div>
        <div className="settings-row">
          <span className="settings-icon">{isOnline ? <Wifi size={20} /> : <WifiOff size={20} />}</span>
          <div className="flex-1"><h2 className="settings-title">網路狀態</h2><p className="settings-detail">{isOnline ? '已連線' : '離線，仍可使用本機功能'}</p></div>
          <span className={`status-badge ${isOnline ? 'status-ready' : 'status-error'}`}>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        <div className="settings-row">
          <span className="settings-icon"><ServerCog size={20} /></span>
          <div className="flex-1"><h2 className="settings-title">Service Worker</h2><p className="settings-detail">{serviceWorkerStatus === 'ready' ? '離線 App Shell 已就緒' : serviceWorkerStatus === 'registering' ? '正在準備離線功能' : serviceWorkerStatus === 'unsupported' ? '此瀏覽器不支援' : '註冊失敗'}</p></div>
          <span className={`status-badge ${serviceWorkerStatus === 'ready' ? 'status-ready' : serviceWorkerStatus === 'error' ? 'status-error' : 'status-idle'}`}>{serviceWorkerStatus}</span>
        </div>
      </section>

      {showInstallExperience && installPlatform === 'standard' && canPromptInstall && (
        <button type="button" className="install-app-button" onClick={() => void install()}><Smartphone size={18} />安裝 Daily AI</button>
      )}
      {showInstallExperience && installPlatform === 'android' && (
        <div className="ios-install-guide"><Smartphone size={18} /><div><strong>安裝到 Android</strong><span>開啟 Chrome 選單，選擇「安裝應用程式」或「加到主畫面」。</span></div></div>
      )}
      {showInstallExperience && installPlatform === 'ios-safari' && (
        <div className="ios-install-guide"><Share size={18} /><div><strong>加入 iPhone 主畫面</strong><span>點選 Safari 的分享按鈕，再選擇「加入主畫面」。</span></div></div>
      )}
      {showInstallExperience && installPlatform === 'ios-browser' && (
        <div className="ios-install-guide"><Share size={18} /><div><strong>請改用 Safari 安裝</strong><span>在 Safari 開啟 Daily AI，點選分享，再選擇「加入主畫面」。</span></div></div>
      )}

      <p className="section-label">Local Data</p>
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
        <p className="mt-1 text-sm leading-6 text-stone-500 dark:text-stone-400">包含事件、照片與附件；用於完整備份、合併或還原。</p>
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

      {message && (
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
