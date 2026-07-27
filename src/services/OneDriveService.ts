import { microsoftAuthService, type MicrosoftAuthService } from './MicrosoftAuthService'

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0'
const APP_FOLDER = 'Daily AI'
const PHOTOS_FOLDER = 'Photos'
const ATTACHMENTS_FOLDER = 'Attachments'
const CONFIG_FILE = 'config.json'
const WORKBOOK_FILE = 'Daily.xlsx'

export interface DailyAIConfig {
  schemaVersion: number
  language: string
  currency: string
  excel: string
  photoFolder: string
  attachmentFolder: string
}

interface DriveItem {
  id: string
  name: string
  folder?: Record<string, unknown>
}

export const defaultConfig: DailyAIConfig = {
  schemaVersion: 1,
  language: 'zh-TW',
  currency: 'TWD',
  excel: 'Daily.xlsx',
  photoFolder: PHOTOS_FOLDER,
  attachmentFolder: ATTACHMENTS_FOLDER,
}

export class OneDriveService {
  constructor(private readonly authService: MicrosoftAuthService = microsoftAuthService) {}

  async createAppFolder(): Promise<DriveItem> {
    return this.getOrCreateFolder(APP_FOLDER)
  }

  async createPhotosFolder(): Promise<DriveItem> {
    const appFolder = await this.createAppFolder()
    return this.getOrCreateFolder(PHOTOS_FOLDER, appFolder.id)
  }

  async createAttachmentsFolder(): Promise<DriveItem> {
    const appFolder = await this.createAppFolder()
    return this.getOrCreateFolder(ATTACHMENTS_FOLDER, appFolder.id)
  }

  async readConfig(): Promise<DailyAIConfig> {
    const response = await this.graphFetch(this.configPath(), { method: 'GET' }, true)

    if (response.status === 404) {
      await this.writeConfig(defaultConfig)
      return { ...defaultConfig }
    }

    if (!response.ok) await this.throwGraphError(response)
    return response.json() as Promise<DailyAIConfig>
  }

  async writeConfig(config: DailyAIConfig = defaultConfig): Promise<void> {
    await this.createAppFolder()
    const response = await this.graphFetch(this.configPath(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(config, null, 2),
    })

    if (!response.ok) await this.throwGraphError(response)
  }

  async readWorkbook(): Promise<ArrayBuffer | null> {
    const metadataResponse = await this.graphFetch(this.workbookMetadataPath(), { method: 'GET' }, true)

    if (metadataResponse.status === 404) return null
    if (!metadataResponse.ok) await this.throwGraphError(metadataResponse)

    const metadata = await metadataResponse.json() as { '@microsoft.graph.downloadUrl'?: string }
    const downloadUrl = metadata['@microsoft.graph.downloadUrl']
    if (!downloadUrl) throw new Error('OneDrive workbook download URL is unavailable')

    const contentResponse = await fetch(downloadUrl)
    if (!contentResponse.ok) await this.throwGraphError(contentResponse)
    return contentResponse.arrayBuffer()
  }

  async writeWorkbook(data: Uint8Array): Promise<void> {
    await this.createAppFolder()
    const uploadData = new Uint8Array(data.byteLength)
    uploadData.set(data)
    const response = await this.graphFetch(this.workbookContentPath(), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      body: new Blob([uploadData.buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    })

    if (!response.ok) await this.throwGraphError(response)
  }

  private async getOrCreateFolder(name: string, parentId?: string): Promise<DriveItem> {
    const existing = await this.findFolder(name, parentId)
    if (existing) return existing

    const endpoint = parentId
      ? `/me/drive/items/${parentId}/children`
      : '/me/drive/root/children'
    const response = await this.graphFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      }),
    })

    if (!response.ok) await this.throwGraphError(response)
    return response.json() as Promise<DriveItem>
  }

  private async findFolder(name: string, parentId?: string): Promise<DriveItem | null> {
    const endpoint = parentId
      ? `/me/drive/items/${parentId}/children?$select=id,name,folder`
      : '/me/drive/root/children?$select=id,name,folder'
    const response = await this.graphFetch(endpoint)
    if (!response.ok) await this.throwGraphError(response)
    const data = await response.json() as { value: DriveItem[] }
    return data.value.find((item) => item.name === name && item.folder) ?? null
  }

  private configPath(): string {
    return `/me/drive/root:/${encodeURIComponent(APP_FOLDER)}/${CONFIG_FILE}:/content`
  }

  private workbookMetadataPath(): string {
    return `/me/drive/root:/${encodeURIComponent(APP_FOLDER)}/${WORKBOOK_FILE}?$select=id,@microsoft.graph.downloadUrl`
  }

  private workbookContentPath(): string {
    return `/me/drive/root:/${encodeURIComponent(APP_FOLDER)}/${WORKBOOK_FILE}:/content`
  }

  private async graphFetch(path: string, init: RequestInit = {}, allowNotFound = false): Promise<Response> {
    const accessToken = await this.authService.getAccessToken()
    const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
    })

    if (!allowNotFound && response.status === 404) {
      await this.throwGraphError(response)
    }

    return response
  }

  private async throwGraphError(response: Response): Promise<never> {
    const message = await response.text()
    throw new Error(`Microsoft Graph ${response.status}: ${message || response.statusText}`)
  }
}

export const oneDriveService = new OneDriveService()
