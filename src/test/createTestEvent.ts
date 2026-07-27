import type { Event } from '../models/Event'

export const createTestEvent = (overrides: Partial<Event> = {}): Event => ({
  id: 'event-001',
  date: '2026-07-27',
  title: '測試事件',
  detail: '這是一筆測試事件。',
  category: 'work',
  amount: 1200,
  tags: ['測試', '工作'],
  attachmentIds: [],
  createdAt: '2026-07-27T08:00:00.000Z',
  updatedAt: '2026-07-27T08:00:00.000Z',
  ...overrides,
})
