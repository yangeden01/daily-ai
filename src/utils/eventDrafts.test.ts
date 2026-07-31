import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearCreateEventDraft,
  clearEditEventDraft,
  getCreateEventDraft,
  getEditEventDraft,
  saveCreateEventDraft,
  saveEditEventDraft,
} from './eventDrafts'

beforeEach(() => {
  clearCreateEventDraft()
  clearCreateEventDraft('notes')
  clearEditEventDraft('event-1')
})

describe('event drafts', () => {
  it('keeps an unfinished create draft until it is cleared', () => {
    saveCreateEventDraft({
      eventDate: '2026-07-31', title: '尚未完成', detail: '切換頁面後繼續', category: '私事',
      tags: ['草稿'], tagInput: '待辦', pendingFiles: [],
    })
    expect(getCreateEventDraft()).toMatchObject({ title: '尚未完成', detail: '切換頁面後繼續', tags: ['草稿'] })
    clearCreateEventDraft()
    expect(getCreateEventDraft()).toBeNull()
  })

  it('keeps edit drafts isolated by event id', () => {
    saveEditEventDraft('event-1', {
      eventDate: '2026-07-30', title: '修改中', detail: '尚未儲存', category: '公事',
      tags: ['工作'], tagInput: '', newFiles: [], removedAttachmentIds: ['attachment-1'],
    })
    expect(getEditEventDraft('event-1')).toMatchObject({ title: '修改中', removedAttachmentIds: ['attachment-1'] })
    expect(getEditEventDraft('event-2')).toBeNull()
  })

  it('keeps Daily and Notes create drafts separate', () => {
    saveCreateEventDraft({
      eventDate: '2026-07-31', title: 'Daily 草稿', detail: '', category: '',
      tags: [], tagInput: '', pendingFiles: [],
    })
    saveCreateEventDraft({
      eventDate: '', title: 'Notes 草稿', detail: '不含日期', category: '',
      tags: [], tagInput: '', pendingFiles: [],
    }, 'notes')

    expect(getCreateEventDraft()).toMatchObject({ title: 'Daily 草稿' })
    expect(getCreateEventDraft('notes')).toMatchObject({ title: 'Notes 草稿', eventDate: '' })
  })
})
