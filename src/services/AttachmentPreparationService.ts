import { validateAttachmentFile } from '../utils/attachments'
import { loadPhotoStorageMode, optimizeSelectedFiles } from '../utils/photoStorage'

export const prepareSelectedAttachments = async (files: File[]): Promise<File[]> => {
  const validationError = files.map(validateAttachmentFile).find(Boolean)
  if (validationError) throw new Error(validationError)

  return optimizeSelectedFiles(files, loadPhotoStorageMode())
}
