import { registerPlugin } from '@capacitor/core'

export interface SaveFileOptions {
  fileName: string
  base64Data: string
  mimeType?: string
  shareAfterSave?: boolean
}

export interface SaveFileResult {
  success: boolean
  savedLocation: string
  fileName: string
  fileSize: number
}

export interface ShareFileOptions {
  fileName: string
  base64Data: string
  mimeType?: string
}

export interface FileBridgePlugin {
  saveFileToDevice(options: SaveFileOptions): Promise<SaveFileResult>
  shareFile(options: ShareFileOptions): Promise<{ success: boolean }>
}

export const FileBridge = registerPlugin<FileBridgePlugin>('FileBridge')
