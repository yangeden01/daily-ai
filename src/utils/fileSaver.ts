import { Capacitor } from '@capacitor/core'
import { FileBridge } from '../services/fileBridge'

export interface SaveFileParams {
  fileName: string
  data: Uint8Array | Blob | string
  mimeType?: string
  shareAfterSave?: boolean
}

export interface FileSaveOutcome {
  success: boolean
  location: string
  fileName: string
  fileSizeText: string
  isNative: boolean
  base64Data?: string
  mimeType?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function dataToBase64(data: Uint8Array | Blob | string): Promise<string> {
  if (typeof data === 'string') {
    return btoa(unescape(encodeURIComponent(data)))
  }
  if (data instanceof Blob) {
    const buffer = await data.arrayBuffer()
    return uint8ArrayToBase64(new Uint8Array(buffer))
  }
  return uint8ArrayToBase64(data)
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  const chunkSize = 8192
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len))
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}

export async function saveFile(params: SaveFileParams): Promise<FileSaveOutcome> {
  const { fileName, data, mimeType = 'application/octet-stream', shareAfterSave = false } = params

  const byteLength = typeof data === 'string'
    ? new Blob([data]).size
    : data instanceof Blob
      ? data.size
      : data.byteLength

  const sizeText = formatBytes(byteLength)

  // 1. Android Native App (Capacitor)
  if (Capacitor.isNativePlatform()) {
    const base64Data = await dataToBase64(data)
    const result = await FileBridge.saveFileToDevice({
      fileName,
      base64Data,
      mimeType,
      shareAfterSave
    })

    return {
      success: true,
      location: result.savedLocation || '手機內部儲存空間 / Download (下載)',
      fileName: result.fileName || fileName,
      fileSizeText: sizeText,
      isNative: true,
      base64Data,
      mimeType
    }
  }

  // 2. Web Browser: Try Modern File System Access API (showSaveFilePicker)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const picker = (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker
      const handle = await picker({
        suggestedName: fileName,
        types: [
          {
            description: fileName.endsWith('.zip') ? 'ZIP 壓縮備份檔' : '備份檔案',
            accept: { [mimeType]: [fileName.includes('.') ? `.${fileName.split('.').pop()}` : '.*'] }
          }
        ]
      })
      const writable = await (handle as FileSystemFileHandle).createWritable()
      const rawData = typeof data === 'string'
        ? new TextEncoder().encode(data)
        : data instanceof Blob
          ? await data.arrayBuffer()
          : data
      await writable.write(rawData)
      await writable.close()

      return {
        success: true,
        location: `已儲存至您指定的檔案路徑：${handle.name || fileName}`,
        fileName: handle.name || fileName,
        fileSizeText: sizeText,
        isNative: false
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        throw new Error('已取消儲存檔案')
      }
      // Fall through to traditional <a> download if user cancelled picker or picker failed
    }
  }

  // 3. Fallback: Classic Browser <a> tag download
  const blob = typeof data === 'string'
    ? new Blob([data], { type: mimeType })
    : data instanceof Blob
      ? data
      : new Blob([data.slice().buffer], { type: mimeType })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  return {
    success: true,
    location: '瀏覽器預設下載資料夾（Downloads）',
    fileName,
    fileSizeText: sizeText,
    isNative: false
  }
}

export async function shareExportedFile(fileName: string, base64Data: string, mimeType = 'application/octet-stream'): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await FileBridge.shareFile({ fileName, base64Data, mimeType })
  } else if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Uint8Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const file = new File([byteNumbers], fileName, { type: mimeType })
      await navigator.share({
        files: [file],
        title: fileName
      })
    } catch {
      // User cancelled share
    }
  }
}
