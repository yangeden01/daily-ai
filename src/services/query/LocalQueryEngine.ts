import type { EventQueryResult } from '../../models/EventQuery'
import { eventRepository } from '../../repositories'
import type { EventRepository } from '../../repositories/EventRepository'
import { LocalQueryExecutor } from './LocalQueryExecutor'
import { LocalQueryParser } from './LocalQueryParser'
import type { QueryParser } from './QueryParser'

export class LocalQueryEngine {
  private readonly executor: LocalQueryExecutor

  constructor(
    private readonly parser: QueryParser,
    repository: EventRepository,
  ) {
    this.executor = new LocalQueryExecutor(repository)
  }

  async query(rawText: string, now = new Date()): Promise<EventQueryResult | null> {
    const parsed = this.parser.parse(rawText, now)
    return parsed ? this.executor.execute(parsed) : null
  }
}

export const localQueryEngine = new LocalQueryEngine(new LocalQueryParser(), eventRepository)
