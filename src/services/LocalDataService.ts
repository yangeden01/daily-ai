import { attachmentRepository, eventRepository } from '../repositories'
import type { AttachmentRepository } from '../repositories/AttachmentRepository'
import type { EventRepository } from '../repositories/EventRepository'

export interface LocalDataResetResult {
  eventCount: number
  attachmentCount: number
}

export class LocalDataService {
  constructor(
    private readonly events: EventRepository = eventRepository,
    private readonly attachments: AttachmentRepository = attachmentRepository,
  ) {}

  async reset(): Promise<LocalDataResetResult> {
    const [previousEvents, previousAttachments] = await Promise.all([
      this.events.getAll(),
      this.attachments.getAll(),
    ])

    try {
      await this.events.replaceAll([])
      await this.attachments.replaceAll([])
    } catch (error) {
      try {
        await this.events.replaceAll(previousEvents)
        await this.attachments.replaceAll(previousAttachments)
      } catch {
        throw new Error('清除失敗，且無法完整回復原有資料。請立即重新載入 App 並檢查資料。')
      }
      throw error
    }

    return {
      eventCount: previousEvents.length,
      attachmentCount: previousAttachments.length,
    }
  }
}

export const localDataService = new LocalDataService()
