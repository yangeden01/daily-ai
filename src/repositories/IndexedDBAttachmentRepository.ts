import type { Attachment } from '../models/Attachment'
import type { AttachmentRepository } from './AttachmentRepository'

const DATABASE_NAME = 'daily-ai-attachments'
const DATABASE_VERSION = 1
const STORE_NAME = 'attachments'

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB attachment request failed'))
  })

const transactionToPromise = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB attachment transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB attachment transaction aborted'))
  })

export class IndexedDBAttachmentRepository implements AttachmentRepository {
  private databasePromise: Promise<IDBDatabase> | null = null

  constructor(private readonly databaseName = DATABASE_NAME) {}

  async getAll(): Promise<Attachment[]> {
    const database = await this.getDatabase()
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const items = await requestToPromise(transaction.objectStore(STORE_NAME).getAll() as IDBRequest<Attachment[]>)
    await transactionToPromise(transaction)
    return items
  }

  async getByEventId(eventId: string): Promise<Attachment[]> {
    const database = await this.getDatabase()
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const index = transaction.objectStore(STORE_NAME).index('eventId')
    const items = await requestToPromise(index.getAll(eventId) as IDBRequest<Attachment[]>)
    await transactionToPromise(transaction)
    return items
  }

  async addMany(attachments: Attachment[]): Promise<Attachment[]> {
    if (attachments.length === 0) return []
    const database = await this.getDatabase()
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    attachments.forEach((attachment) => store.add(attachment))
    await transactionToPromise(transaction)
    return attachments
  }

  async delete(id: string): Promise<void> {
    const database = await this.getDatabase()
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(id)
    await transactionToPromise(transaction)
  }

  async deleteByEventId(eventId: string): Promise<void> {
    const database = await this.getDatabase()
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const keys = await requestToPromise(store.index('eventId').getAllKeys(eventId))
    keys.forEach((key) => store.delete(key))
    await transactionToPromise(transaction)
  }

  async replaceAll(attachments: Attachment[]): Promise<void> {
    const database = await this.getDatabase()
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    store.clear()
    attachments.forEach((attachment) => store.add(attachment))
    await transactionToPromise(transaction)
  }

  private getDatabase(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = globalThis.indexedDB.open(this.databaseName, DATABASE_VERSION)
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('eventId', 'eventId')
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Unable to open attachment database'))
      })
    }
    return this.databasePromise
  }
}
