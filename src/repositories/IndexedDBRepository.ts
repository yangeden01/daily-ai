import type { Event } from '../models/Event'
import type { EventSearchCriteria } from '../models/EventSearchCriteria'
import { filterEvents } from '../utils/filterEvents'
import type { EventRepository } from './EventRepository'

const DATABASE_NAME = 'daily-ai'
const DATABASE_VERSION = 1
const EVENT_STORE = 'events'

const copyEvent = (event: Event): Event => ({
  ...event,
  tags: [...event.tags],
  attachmentIds: [...event.attachmentIds],
})

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })

const transactionToPromise = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })

export class IndexedDBRepository implements EventRepository {
  private databasePromise: Promise<IDBDatabase> | null = null

  constructor(
    private readonly databaseName = DATABASE_NAME,
    private readonly seedEvents: Event[] = [],
  ) {}

  async getAll(): Promise<Event[]> {
    const database = await this.getDatabase()
    const transaction = database.transaction(EVENT_STORE, 'readonly')
    const events = await requestToPromise(transaction.objectStore(EVENT_STORE).getAll() as IDBRequest<Event[]>)
    await transactionToPromise(transaction)
    return events.map(copyEvent)
  }

  async getById(id: string): Promise<Event | undefined> {
    const database = await this.getDatabase()
    const transaction = database.transaction(EVENT_STORE, 'readonly')
    const event = await requestToPromise(transaction.objectStore(EVENT_STORE).get(id) as IDBRequest<Event | undefined>)
    await transactionToPromise(transaction)
    return event ? copyEvent(event) : undefined
  }

  async search(criteria: EventSearchCriteria): Promise<Event[]> {
    return filterEvents(await this.getAll(), criteria)
  }

  async add(event: Event): Promise<Event> {
    const database = await this.getDatabase()
    const transaction = database.transaction(EVENT_STORE, 'readwrite')
    transaction.objectStore(EVENT_STORE).add(copyEvent(event))
    await transactionToPromise(transaction)
    return copyEvent(event)
  }

  async update(id: string, event: Event): Promise<Event> {
    const database = await this.getDatabase()
    const transaction = database.transaction(EVENT_STORE, 'readwrite')
    const store = transaction.objectStore(EVENT_STORE)
    const existing = await requestToPromise(store.get(id) as IDBRequest<Event | undefined>)

    if (!existing) {
      transaction.abort()
      throw new Error(`Event not found: ${id}`)
    }

    const updatedEvent = copyEvent({ ...event, id })
    store.put(updatedEvent)
    await transactionToPromise(transaction)
    return copyEvent(updatedEvent)
  }

  async delete(id: string): Promise<void> {
    const database = await this.getDatabase()
    const transaction = database.transaction(EVENT_STORE, 'readwrite')
    transaction.objectStore(EVENT_STORE).delete(id)
    await transactionToPromise(transaction)
  }

  async replaceAll(events: Event[]): Promise<void> {
    const database = await this.getDatabase()
    const transaction = database.transaction(EVENT_STORE, 'readwrite')
    const store = transaction.objectStore(EVENT_STORE)
    store.clear()
    events.forEach((event) => store.add(copyEvent(event)))
    await transactionToPromise(transaction)
  }

  private getDatabase(): Promise<IDBDatabase> {
    if (!this.databasePromise) this.databasePromise = this.openDatabase()
    return this.databasePromise
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error('This browser does not support IndexedDB'))
        return
      }

      const request = globalThis.indexedDB.open(this.databaseName, DATABASE_VERSION)

      request.onupgradeneeded = () => {
        const database = request.result
        const store = database.createObjectStore(EVENT_STORE, { keyPath: 'id' })
        store.createIndex('date', 'date')
        store.createIndex('updatedAt', 'updatedAt')
        this.seedEvents.forEach((event) => store.add(copyEvent(event)))
      }

      request.onsuccess = () => {
        const database = request.result
        database.onversionchange = () => database.close()
        resolve(database)
      }
      request.onerror = () => reject(request.error ?? new Error('Unable to open Daily AI database'))
      request.onblocked = () => reject(new Error('Daily AI database upgrade is blocked by another tab'))
    })
  }
}
