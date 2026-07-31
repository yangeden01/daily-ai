export interface CreateEventDraft {
  eventDate: string
  title: string
  detail: string
  category: string
  tags: string[]
  tagInput: string
  pendingFiles: File[]
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
}

const createEventDrafts = new Map<'daily' | 'notes', CreateEventDraft>()
const editEventDrafts = new Map<string, EditEventDraft>()

export const getCreateEventDraft = (mode: 'daily' | 'notes' = 'daily'): CreateEventDraft | null => createEventDrafts.get(mode) ?? null

export const saveCreateEventDraft = (draft: CreateEventDraft, mode: 'daily' | 'notes' = 'daily'): void => {
  createEventDrafts.set(mode, { ...draft, tags: [...draft.tags], pendingFiles: [...draft.pendingFiles] })
}

export const clearCreateEventDraft = (mode: 'daily' | 'notes' = 'daily'): void => {
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
