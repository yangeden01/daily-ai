import { getAccessToken, googleSignIn } from './googleDriveAuth'

export interface GoogleDriveUploadResult {
  id: string
  name: string
  webViewLink?: string
  size?: string
}

export function extractGoogleDriveFolderId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim()
  if (!trimmed) return null
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1]
  }
  // Check if it's already a raw ID without slashes
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed
  }
  return null
}

export async function uploadBackupToGoogleDrive(params: {
  fileName: string
  data: Uint8Array | Blob
  destinationFolderUrlOrId?: string
}): Promise<GoogleDriveUploadResult> {
  const { fileName, data, destinationFolderUrlOrId } = params

  let token = await getAccessToken()
  if (!token) {
    const signInResult = await googleSignIn()
    if (!signInResult?.accessToken) {
      throw new Error('請先授權登入 Google 帳號以啟用雲端硬碟直接上傳')
    }
    token = signInResult.accessToken
  }

  const folderId = destinationFolderUrlOrId
    ? extractGoogleDriveFolderId(destinationFolderUrlOrId)
    : null

  const metadata: Record<string, unknown> = {
    name: fileName,
    mimeType: 'application/zip',
    description: 'EdenNote / Daily AI 完整資料庫與照片備份封裝檔',
  }

  if (folderId) {
    metadata.parents = [folderId]
  }

  const boundary = `-------DailyAiBackup${Date.now()}`
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelimiter = `\r\n--${boundary}--`

  const metaPart =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/zip\r\n\r\n'

  const binaryBlob =
    data instanceof Blob
      ? data
      : new Blob([data.slice().buffer], { type: 'application/zip' })

  const multipartBody = new Blob([metaPart, binaryBlob, closeDelimiter], {
    type: `multipart/related; boundary=${boundary}`,
  })

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: multipartBody,
    }
  )

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text().catch(() => '')
    let errMsg = `Google Drive 上傳失敗 (狀態碼 ${uploadResponse.status})`
    try {
      const errJson = JSON.parse(errText)
      if (errJson?.error?.message) {
        errMsg = `Google Drive 回應：${errJson.error.message}`
      }
    } catch {
      // Use fallback errMsg
    }

    // Check if token expired
    if (uploadResponse.status === 401) {
      throw new Error('Google 授權已過期，請重新登入 Google 帳號後再試')
    }

    throw new Error(errMsg)
  }

  const resultData = await uploadResponse.json()
  return {
    id: resultData.id,
    name: resultData.name || fileName,
    webViewLink:
      resultData.webViewLink ||
      `https://drive.google.com/file/d/${resultData.id}/view`,
    size: resultData.size,
  }
}
