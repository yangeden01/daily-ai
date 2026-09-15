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

const CHUNK_SIZE = 256 * 1024 // 256 KB chunks for low-memory stream transfer

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function normalizeToBlob(data: Uint8Array | Blob | string, mimeType: string): Blob {
  if (data instanceof Blob) {
    return data
  }
  if (typeof data === 'string') {
    return new Blob([data], { type: mimeType })
  }
  return new Blob([data.slice().buffer], { type: mimeType })
}

function blobSliceToBase64(slice: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      if (!result) {
        resolve('')
        return
      }
      const commaIndex = result.indexOf(',')
      resolve(commaIndex >= 0 ? result.substring(commaIndex + 1) : result)
    }
    reader.onerror = () => reject(reader.error || new Error('分塊讀取失敗'))
    reader.readAsDataURL(slice)
  })
}

export async function saveFile(params: SaveFileParams): Promise<FileSaveOutcome> {
  const { fileName, data, mimeType = 'application/octet-stream', shareAfterSave = false } = params
  const blob = normalizeToBlob(data, mimeType)
  const sizeText = formatBytes(blob.size)

  // 1. Android Native App (Capacitor)
  if (Capacitor.isNativePlatform()) {
    // Attempt chunked stream saving to completely prevent OOM / heap crashes
    if (typeof FileBridge.startSaveFile === 'function') {
      let transferId = ''
      try {
        const startResult = await FileBridge.startSaveFile({
          fileName,
          mimeType,
        })
        transferId = startResult.transferId

        const totalBytes = blob.size
        let offset = 0

        while (offset < totalBytes) {
          const slice = blob.slice(offset, Math.min(offset + CHUNK_SIZE, totalBytes))
          const chunkBase64 = await blobSliceToBase64(slice)
          await FileBridge.appendFileChunk({
            transferId,
            chunkBase64,
          })
          offset += CHUNK_SIZE
        }

        const finishResult = await FileBridge.finishSaveFile({
          transferId,
          shareAfterSave,
        })

        return {
          success: true,
          location: finishResult.savedLocation || '手機內部儲存空間 / Download (下載)',
          fileName: finishResult.fileName || fileName,
          fileSizeText: sizeText,
          isNative: true,
          mimeType,
        }
      } catch (chunkError) {
        if (transferId) {
          try {
            await FileBridge.cancelSaveFile({ transferId })
          } catch {
            // Ignore cancellation error
          }
        }
        throw chunkError
      }
    }

    // Fallback for older plugin interface: convert blob safely using FileReader
    const base64Data = await blobSliceToBase64(blob)
    const result = await FileBridge.saveFileToDevice({
      fileName,
      base64Data,
      mimeType,
      shareAfterSave,
    })

    return {
      success: true,
      location: result.savedLocation || '手機內部儲存空間 / Download (下載)',
      fileName: result.fileName || fileName,
      fileSizeText: sizeText,
      isNative: true,
      base64Data,
      mimeType,
    }
  }

  // 2. Web Browser: Modern File System Access API (showSaveFilePicker)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const picker = (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker
      const handle = await picker({
        suggestedName: fileName,
        types: [
          {
            description: fileName.endsWith('.zip') ? 'ZIP 壓縮備份檔' : '備份檔案',
            accept: { [mimeType]: [fileName.includes('.') ? `.${fileName.split('.').pop()}` : '.*'] },
          },
        ],
      })
      const writable = await (handle as FileSystemFileHandle).createWritable()
      await writable.write(blob)
      await writable.close()

      return {
        success: true,
        location: `已儲存至您指定的檔案路徑：${handle.name || fileName}`,
        fileName: handle.name || fileName,
        fileSizeText: sizeText,
        isNative: false,
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        throw new Error('已取消儲存檔案')
      }
      // Fall through to traditional <a> download if user cancelled picker or picker failed
    }
  }

  // 3. Fallback: Classic Browser <a> tag download
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
    isNative: false,
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
        title: fileName,
      })
    } catch {
      // User cancelled share
    }
  }
}
