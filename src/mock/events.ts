import type { Event } from '../models/Event'

export const mockEvents: Event[] = [
  {
    id: 'event-work-001',
    date: '2026-07-27',
    title: 'Volta EVT 時程調整',
    detail: '今天跟 Dell VP 討論 Volta EVT 延一週。',
    category: '工作',
    tags: ['Dell', 'Volta', 'EVT'],
    attachmentIds: [],
    createdAt: '2026-07-27T09:30:00+08:00',
    updatedAt: '2026-07-27T09:30:00+08:00',
  },
  {
    id: 'event-travel-001',
    date: '2026-06-15',
    title: '九州旅行第五天',
    detail: '九州旅行第五天。',
    category: '旅遊',
    tags: ['日本', '九州'],
    attachmentIds: [],
    createdAt: '2026-06-15T20:15:00+08:00',
    updatedAt: '2026-06-15T20:15:00+08:00',
  },
  {
    id: 'event-finance-001',
    date: '2026-05-31',
    title: '繳納綜合所得稅',
    detail: '繳綜合所得稅158320元。',
    category: '財務',
    amount: 158320,
    tags: ['稅務'],
    attachmentIds: [],
    createdAt: '2026-05-31T14:00:00+08:00',
    updatedAt: '2026-05-31T14:00:00+08:00',
  },
]
