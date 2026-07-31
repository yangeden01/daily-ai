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

let createEventDraft: CreateEventDraft | null = null
const editEventDrafts = new Map<string, EditEventDraft>()

export const getCreateEventDraft = (): CreateEventDraft | null => createEventDraft

export const saveCreateEventDraft = (draft: CreateEventDraft): void => {
  createEventDraft = { ...draft, tags: [...draft.tags], pendingFiles: [...draft.pendingFiles] }
}

export const clearCreateEventDraft = (): void => {
  createEventDraft = null
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
