import type { EventQueryResult } from '../../models/EventQuery'
import { attachmentRepository, eventRepository } from '../../repositories'
import type { EventRepository } from '../../repositories/EventRepository'
import type { AttachmentRepository } from '../../repositories/AttachmentRepository'
import { LocalQueryExecutor } from './LocalQueryExecutor'
import { LocalQueryParser } from './LocalQueryParser'
import type { QueryParser } from './QueryParser'

export class LocalQueryEngine {
  private readonly executor: LocalQueryExecutor

  constructor(
    private readonly parser: QueryParser,
    repository: EventRepository,
    attachmentRepository?: AttachmentRepository,
  ) {
    this.executor = new LocalQueryExecutor(repository, attachmentRepository)
  }

  async query(rawText: string, now = new Date()): Promise<EventQueryResult | null> {
    const parsed = this.parser.parse(rawText, now)
    return parsed ? this.executor.execute(parsed) : null
  }
}

export const localQueryEngine = new LocalQueryEngine(new LocalQueryParser(), eventRepository, attachmentRepository)
