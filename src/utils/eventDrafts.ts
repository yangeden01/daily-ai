import type { AppMode } from './appMode'
import type { CalendarType } from '../models/Event'

export interface CreateEventDraft {
  eventDate: string
  title: string
  detail: string
  category: string
  tags: string[]
  tagInput: string
  pendingFiles: File[]
  calendarType?: CalendarType
  lunarMonth?: number
  lunarDay?: number
  isLeapMonth?: boolean
  targetYear?: number
}

export interface EditEventDraft {
  eventDate: string
  title: string
  detail: string
  category: string
  tags: string[]
  tagInput: string
  newFiles: File[]
  removedAttachmentIds: string[]
  calendarType?: CalendarType
  lunarMonth?: number
  lunarDay?: number
  isLeapMonth?: boolean
  targetYear?: number
}

const createEventDrafts = new Map<AppMode, CreateEventDraft>()
const editEventDrafts = new Map<string, EditEventDraft>()

export const getCreateEventDraft = (mode: AppMode = 'daily'): CreateEventDraft | null => createEventDrafts.get(mode) ?? null

export const saveCreateEventDraft = (draft: CreateEventDraft, mode: AppMode = 'daily'): void => {
  createEventDrafts.set(mode, { ...draft, tags: [...draft.tags], pendingFiles: [...draft.pendingFiles] })
}

export const clearCreateEventDraft = (mode: AppMode = 'daily'): void => {
  createEventDrafts.delete(mode)
}

export const getEditEventDraft = (eventId: string): EditEventDraft | null => editEventDrafts.get(eventId) ?? null

export const saveEditEventDraft = (eventId: string, draft: EditEventDraft): void => {
  editEventDrafts.set(eventId, {
    ...draft,
    tags: [...draft.tags],
    newFiles: [...draft.newFiles],
    removedAttachmentIds: [...draft.removedAttachmentIds],
  })
}

export const clearEditEventDraft = (eventId: string): void => {
  editEventDrafts.delete(eventId)
}
