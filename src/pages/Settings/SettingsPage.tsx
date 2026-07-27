import { useRef, useState, type ChangeEvent } from 'react'
import { ArchiveRestore, Check, Cloud, Database, Download, FileSpreadsheet, Info, LoaderCircle, Package, ServerCog, Share, Smartphone, Upload, Wifi, WifiOff, X } from 'lucide-react'
import { usePWA } from '../../contexts/PWAContext'

type BackupStatus = 'idle' | 'working' | 'success' | 'error'

export default function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fullBackupInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<BackupStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const { isOnline, isInstalled, isStandalone, installPlatform, canPromptInstall, showInstallExperience, serviceWorkerStatus, install } = usePWA()

  const handleExport = async () => {
    setStatus('working')
    setMessage(null)
    try {
      const { backupService } = await import('../../services/BackupService')
      const data = await backupService.exportWorkbook()
      const copy = new Uint8Array(data.byteLength)
      copy.set(data)
      const url = URL.createObjectURL(new Blob([copy.buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'Daily.xlsx'
      link.click()
      URL.revokeObjectURL(url)
      setStatus('success')
      setMessage('Daily.xlsx 備份已匯出。')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '備份匯出失敗')
    }
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const confirmed = window.confirm(`匯入 ${file.name} 將覆蓋目前所有事件，確定繼續嗎？`)
    if (!confirmed) return

    setStatus('working')
    setMessage(null)
    try {
      const { backupService } = await import('../../services/BackupService')
      const count = await backupService.importWorkbook(await file.arrayBuffer())
      setStatus('success')
      setMessage(`已從備份還原 ${count} 筆事件。`)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '備份匯入失敗')
    }
  }

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
      link.click()
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

  return (
    <main className="page-enter">
      <p className="section-label">App Status</p>
      <section className="settings-card divide-y divide-stone-100 dark:divide-white/10">
        <div className="settings-row">
          <span className="settings-icon"><Info size={20} /></span>
          <div className="flex-1"><h2 className="settings-title">App Version</h2><p className="settings-detail">v0.1 Alpha</p></div>
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
      {showInstallExperience && installPlatform === 'ios' && (
        <div className="ios-install-guide"><Share size={18} /><div><strong>加入 iPhone 主畫面</strong><span>在 Safari 點選分享，再選擇「加入主畫面」。</span></div></div>
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
      <section className="settings-card">
        <div className="settings-row">
          <span className="settings-icon"><Package size={20} /></span>
          <div className="flex-1">
            <h2 className="settings-title">ZIP 完整備份</h2>
            <p className="settings-detail">包含事件、照片與附件原始檔案</p>
          </div>
        </div>
      </section>
      <input ref={fullBackupInputRef} type="file" accept=".zip,application/zip" className="sr-only" onChange={handleFullImport} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" className="backup-button backup-button-primary" onClick={handleFullExport} disabled={status === 'working'}>
          {status === 'working' ? <LoaderCircle size={18} className="animate-spin" /> : <Download size={18} />}
          匯出完整備份
        </button>
        <button type="button" className="backup-button backup-button-secondary" onClick={() => fullBackupInputRef.current?.click()} disabled={status === 'working'}>
          <ArchiveRestore size={18} />完整還原
        </button>
      </div>

      <p className="section-label mt-8">Excel 備份</p>
      <section className="settings-card">
        <div className="settings-row">
          <span className="settings-icon"><FileSpreadsheet size={20} /></span>
          <div className="flex-1">
            <h2 className="settings-title">Daily.xlsx</h2>
            <p className="settings-detail">只備份附件 metadata，不包含實際照片與檔案</p>
          </div>
        </div>
      </section>

      <p className="mt-3 px-1 text-xs leading-5 text-amber-700 dark:text-amber-300">Excel 備份不包含照片與附件的二進位內容；實際檔案只保存在目前瀏覽器。</p>

      <input ref={fileInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={handleImport} />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" className="backup-button backup-button-primary" onClick={handleExport} disabled={status === 'working'}>
          {status === 'working' ? <LoaderCircle size={18} className="animate-spin" /> : <Download size={18} />}
          匯出備份
        </button>
        <button type="button" className="backup-button backup-button-secondary" onClick={() => fileInputRef.current?.click()} disabled={status === 'working'}>
          <Upload size={18} />匯入備份
        </button>
      </div>

      {message && (
        <div className={status === 'error' ? 'error-notice' : 'success-notice'} role={status === 'error' ? 'alert' : 'status'}>
          {status === 'error' ? <X size={16} /> : <Check size={16} />}
          <span>{message}</span>
        </div>
      )}

      <p className="section-label mt-8">Cloud</p>
      <section className="settings-card">
        <div className="settings-row">
          <span className="settings-icon"><Cloud size={20} /></span>
          <div className="flex-1">
            <h2 className="settings-title">OneDrive Sync</h2>
            <p className="settings-detail">未來可選同步功能</p>
          </div>
          <span className="coming-soon">Coming Soon</span>
        </div>
      </section>

    </main>
  )
}
