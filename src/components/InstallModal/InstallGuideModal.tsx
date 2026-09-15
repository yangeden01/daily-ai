import { useState } from 'react'
import { Check, Copy, ExternalLink, Share, Smartphone, X } from 'lucide-react'
import { usePWA } from '../../contexts/PWAContext'

interface InstallGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function InstallGuideModal({ isOpen, onClose }: InstallGuideModalProps) {
  const { installPlatform, canPromptInstall, install, openInNewTab, isInIframe } = usePWA()
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleCopy = () => {
    try {
      void navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-stone-900 border border-stone-200 dark:border-stone-800 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <img src="/icon-192.png" alt="App Icon" className="w-8 h-8 rounded-xl shadow-xs object-cover" />
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">安裝 手機記事本 App</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="py-4 space-y-4 text-sm text-stone-700 dark:text-stone-300">
          {isInIframe && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200">
              <strong className="block font-semibold mb-1">注意：目前在內嵌預覽視窗內</strong>
              瀏覽器安全政策禁止在 iframe 框架中安裝 App。請點擊「在新分頁開啟」後再進行安裝。
              <button
                type="button"
                onClick={openInNewTab}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-xs"
              >
                <ExternalLink size={14} />
                在新分頁開啟
              </button>
            </div>
          )}

          {canPromptInstall ? (
            <div className="space-y-3">
              <p>瀏覽器已支援一鍵直接安裝：</p>
              <button
                type="button"
                onClick={() => {
                  void install()
                  onClose()
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold shadow-sm transition-colors"
              >
                <Smartphone size={18} />
                立即安裝到手機主畫面
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="font-medium text-stone-900 dark:text-stone-100">手機主畫面安裝步驟：</p>

              {installPlatform === 'ios' ? (
                <ol className="space-y-2.5 text-xs leading-relaxed list-decimal list-inside bg-stone-50 dark:bg-stone-800/50 p-3.5 rounded-xl border border-stone-200 dark:border-stone-700/50">
                  <li>點擊 Safari 底部工具列的「<strong>分享</strong>」圖示 <Share className="inline w-3.5 h-3.5 mx-0.5 text-indigo-600" /></li>
                  <li>在功能選單中往下滑動，找到並點選「<strong>加入主畫面</strong>」</li>
                  <li>右上角點選「<strong>新增</strong>」即完成安裝！</li>
                </ol>
              ) : (
                <ol className="space-y-2.5 text-xs leading-relaxed list-decimal list-inside bg-stone-50 dark:bg-stone-800/50 p-3.5 rounded-xl border border-stone-200 dark:border-stone-700/50">
                  <li>點選 Chrome / 瀏覽器右上角的「<strong>三點選單（⋮）</strong>」</li>
                  <li>選擇「<strong>安裝應用程式</strong>」或「<strong>加到主螢幕</strong>」</li>
                  <li>確認後手機桌面即會產生具有專屬記事本圖示的獨立 App！</li>
                </ol>
              )}

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {copied ? '已複製網址' : '複製 App 連結'}
                </button>
                <button
                  type="button"
                  onClick={openInNewTab}
                  className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-medium"
                >
                  <ExternalLink size={14} />
                  獨立分頁
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  )
}
