import type { Attachment } from '../models/Attachment'

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024
const DANGEROUS_EXTENSIONS = new Set([
  'bat', 'cmd', 'com', 'cpl', 'exe', 'hta', 'jar', 'js', 'jse', 'lnk', 'msi', 'msp',
  'pif', 'ps1', 'reg', 'scr', 'vbe', 'vbs', 'wsf', 'wsh',
])
const DANGEROUS_MIME_TYPES = new Set([
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-sh',
])

export const validateAttachmentFile = (file: File): string | null => {
  if (file.size > MAX_ATTACHMENT_SIZE) return `${file.name} 超過 10 MB 上限。`
  const extension = file.name.split('.').pop()?.toLocaleLowerCase() ?? ''
  if (DANGEROUS_EXTENSIONS.has(extension) || DANGEROUS_MIME_TYPES.has(file.type.toLocaleLowerCase())) {
    return `${file.name} 是不允許的可執行檔類型。`
  }
  return null
}

export const filesToAttachments = (files: File[], eventId: string): Attachment[] =>
  files.map((file) => ({
    id: crypto.randomUUID(),
    eventId,
    filename: file.name,
    path: '',
    type: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'file',
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    blob: file,
    createdAt: new Date().toISOString(),
  }))

export const formatFileSize = (size: number): string => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
