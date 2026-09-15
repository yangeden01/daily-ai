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

export interface StartSaveOptions {
  fileName: string
  mimeType?: string
}

export interface StartSaveResult {
  success: boolean
  transferId: string
}

export interface AppendChunkOptions {
  transferId: string
  chunkBase64: string
}

export interface AppendChunkResult {
  success: boolean
  bytesWritten: number
}

export interface FinishSaveOptions {
  transferId: string
  shareAfterSave?: boolean
}

export interface FileBridgePlugin {
  saveFileToDevice(options: SaveFileOptions): Promise<SaveFileResult>
  shareFile(options: ShareFileOptions): Promise<{ success: boolean }>
  startSaveFile(options: StartSaveOptions): Promise<StartSaveResult>
  appendFileChunk(options: AppendChunkOptions): Promise<AppendChunkResult>
  finishSaveFile(options: FinishSaveOptions): Promise<SaveFileResult>
  cancelSaveFile(options: { transferId: string }): Promise<{ success: boolean }>
}

export const FileBridge = registerPlugin<FileBridgePlugin>('FileBridge')
