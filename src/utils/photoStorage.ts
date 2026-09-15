export type PhotoStorageMode = 'original' | 'space'

const STORAGE_KEY = 'daily-ai.photo-storage-mode'
const MAX_IMAGE_EDGE = 1920
const WEBP_QUALITY = 0.82

export const loadPhotoStorageMode = (): PhotoStorageMode => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'space' ? 'space' : 'original'
  } catch {
    return 'original'
  }
}

export const savePhotoStorageMode = (mode: PhotoStorageMode): void => {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // The selected mode still works during this session when storage is unavailable.
  }
}

export const calculateImageDimensions = (width: number, height: number, maxEdge = MAX_IMAGE_EDGE) => {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export const canOptimizePhoto = (file: File): boolean => (
  file.type.startsWith('image/')
  && !['image/gif', 'image/svg+xml'].includes(file.type.toLocaleLowerCase())
)

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> => new Promise((resolve) => {
  canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY)
})

export const optimizePhoto = async (file: File): Promise<File> => {
  if (!canOptimizePhoto(file) || typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const dimensions = calculateImageDimensions(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return file
    }
    context.drawImage(bitmap, 0, 0, dimensions.width, dimensions.height)
    bitmap.close()
    const blob = await canvasToBlob(canvas)
    if (!blob || blob.size >= file.size) return file
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: file.lastModified })
  } catch {
    return file
  }
}

export const optimizeSelectedFiles = async (files: File[], mode: PhotoStorageMode): Promise<File[]> => (
  mode === 'space' ? Promise.all(files.map(optimizePhoto)) : files
)
