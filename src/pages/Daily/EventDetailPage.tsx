import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowLeft, Camera, Check, Download, FilePlus2, FileText, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Attachment } from '../../models/Attachment'
import type { Event } from '../../models/Event'
import { attachmentRepository, eventRepository } from '../../repositories'
import { filesToAttachments, formatFileSize, validateAttachmentFile } from '../../utils/attachments'
import { normalizeTags } from '../../utils/normalizeTags'
import { deleteEventWithAttachments } from '../../services/EventDeletionService'

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [activePhoto, setActivePhoto] = useState<Attachment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [eventDate, setEventDate] = useState('')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!eventId) return
    Promise.all([eventRepository.getById(eventId), attachmentRepository.getByEventId(eventId)])
      .then(([item, files]) => {
        setEvent(item ?? null)
        setAttachments(files)
      })
      .catch(() => setErrorMessage('事件或附件載入失敗'))
      .finally(() => setIsLoading(false))
  }, [eventId])

  useEffect(() => {
    const urls = Object.fromEntries(attachments
      .filter((attachment) => attachment.type === 'image' && attachment.blob)
      .map((attachment) => [attachment.id, URL.createObjectURL(attachment.blob!)]))
    setAttachmentUrls(urls)
    return () => Object.values(urls).forEach(URL.revokeObjectURL)
  }, [attachments])

  const startEditing = () => {
    if (!event) return
    setEventDate(event.date)
    setTitle(event.title)
    setDetail(event.detail)
    setCategory(event.category)
    setTags([...event.tags])
    setTagInput('')
    setNewFiles([])
    setRemovedAttachmentIds([])
    setErrorMessage(null)
    setIsEditing(true)
  }

  const handleSave = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault()
    if (!event || !eventDate || !title.trim() || !detail.trim() || !category.trim() || isSaving) return

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const addedAttachments = filesToAttachments(newFiles, event.id)
      await attachmentRepository.addMany(addedAttachments)
      try {
        await eventRepository.update(event.id, {
          ...event,
          date: eventDate,
          title: title.trim(),
          detail: detail.trim(),
          category: category.trim(),
          tags: normalizeTags([...tags, tagInput]),
          attachmentIds: [
            ...attachments.filter(({ id }) => !removedAttachmentIds.includes(id)).map(({ id }) => id),
            ...addedAttachments.map(({ id }) => id),
          ],
          updatedAt: new Date().toISOString(),
        })
      } catch (error) {
        await Promise.all(addedAttachments.map(({ id }) => attachmentRepository.delete(id)))
        throw error
      }
      await Promise.all(removedAttachmentIds.map((id) => attachmentRepository.delete(id)))
      navigate('/daily')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '事件更新失敗')
      setIsSaving(false)
    }
  }

  const selectFiles = (inputEvent: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(inputEvent.target.files ?? [])
    inputEvent.target.value = ''
    const firstError = selected.map(validateAttachmentFile).find(Boolean)
    if (firstError) {
      setErrorMessage(firstError)
      return
    }
    setErrorMessage(null)
    setNewFiles((current) => [...current, ...selected])
  }

  const downloadAttachment = (attachment: Attachment) => {
    if (!attachment.blob) {
      setErrorMessage('此備份只包含附件 metadata，沒有可下載的實際檔案。')
      return
    }
    const url = URL.createObjectURL(attachment.blob)
    const link = document.createElement('a')
    link.href = url
    link.download = attachment.filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const addTags = (values: string[]) => {
    setTags((current) => normalizeTags([...current, ...values]))
  }

  const handleTagInput = (value: string) => {
    if (!value.includes(',')) {
      setTagInput(value)
      return
    }

    const parts = value.split(',')
    addTags(parts.slice(0, -1))
    setTagInput(parts[parts.length - 1] ?? '')
  }

  const handleTagKeyDown = (keyboardEvent: KeyboardEvent<HTMLInputElement>) => {
    if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ',') return
    keyboardEvent.preventDefault()
    addTags([tagInput])
    setTagInput('')
  }

  const removeTag = (tagToRemove: string) => {
    setTags((current) => current.filter((tag) => tag !== tagToRemove))
  }

  const handleDelete = async () => {
    if (!event || isDeleting) return
    const confirmed = window.confirm(`確定要刪除「${event.title}」嗎？\n\n此動作無法復原。`)
    if (!confirmed) return

    setIsDeleting(true)
    setErrorMessage(null)

    try {
      await deleteEventWithAttachments(event)
      navigate('/daily', { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '事件刪除失敗')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return <main className="detail-state"><LoaderCircle className="animate-spin" size={24} /><span>載入事件</span></main>
  }

  if (!event) {
    return <main className="detail-state"><p>{errorMessage ?? '找不到這筆事件。'}</p><Link to="/daily" className="detail-back-link">返回 Timeline</Link></main>
  }

  return (
    <main className="page-enter">
      <div className="mb-5 flex items-center justify-between">
        <Link to="/daily" className="detail-back-link"><ArrowLeft size={17} />Timeline</Link>
        {!isEditing && <button type="button" className="edit-button" onClick={startEditing}><Pencil size={16} />Edit</button>}
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="detail-card p-5 sm:p-6">
          <label className="detail-field-label" htmlFor="event-date">事件日期</label>
          <input id="event-date" type="date" className="detail-input" value={eventDate} onChange={(inputEvent) => setEventDate(inputEvent.target.value)} required />

          <label className="detail-field-label mt-5" htmlFor="event-title">Title</label>
          <input id="event-title" className="detail-input" value={title} onChange={(inputEvent) => setTitle(inputEvent.target.value)} />

          <label className="detail-field-label mt-5" htmlFor="event-detail">Detail</label>
          <textarea id="event-detail" className="detail-input min-h-40 resize-y" value={detail} onChange={(inputEvent) => setDetail(inputEvent.target.value)} />

          <label className="detail-field-label mt-5" htmlFor="event-category">Category</label>
          <input id="event-category" className="detail-input" value={category} onChange={(inputEvent) => setCategory(inputEvent.target.value)} />

          <label className="detail-field-label mt-5" htmlFor="event-tags">Tags</label>
          <div className="tag-editor">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span className="editable-tag" key={tag}>
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} aria-label={`移除 ${tag}`}><X size={13} /></button>
                </span>
              ))}
            </div>
            <div className="tag-input-row">
              <Plus size={16} aria-hidden="true" />
              <input
                id="event-tags"
                value={tagInput}
                onChange={(inputEvent) => handleTagInput(inputEvent.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => { addTags([tagInput]); setTagInput('') }}
                placeholder="輸入 Tag，按 Enter 或逗號新增"
              />
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-stone-400">空白與重複的 Tags 會自動移除。</p>

          <p className="detail-field-label mt-5">照片與附件</p>
          <div className="attachment-edit-actions">
            <button type="button" onClick={() => photoInputRef.current?.click()}><Camera size={17} />新增照片</button>
            <button type="button" onClick={() => attachmentInputRef.current?.click()}><FilePlus2 size={17} />新增附件</button>
          </div>
          <input ref={photoInputRef} aria-label="選擇新增照片" className="sr-only" type="file" accept="image/*" multiple onChange={selectFiles} />
          <input ref={attachmentInputRef} aria-label="選擇新增附件" className="sr-only" type="file" multiple onChange={selectFiles} />
          <div className="mt-3 space-y-2">
            {attachments.filter(({ id }) => !removedAttachmentIds.includes(id)).map((attachment) => (
              <div className="pending-file" key={attachment.id}><span className="min-w-0 flex-1 truncate">{attachment.filename}</span><small>{formatFileSize(attachment.size)}</small><button type="button" onClick={() => setRemovedAttachmentIds((ids) => [...ids, attachment.id])} aria-label={`移除 ${attachment.filename}`}><X size={15} /></button></div>
            ))}
            {newFiles.map((file, index) => (
              <div className="pending-file" key={`${file.name}-${file.lastModified}-${index}`}><span className="min-w-0 flex-1 truncate">{file.name}</span><small>{formatFileSize(file.size)}</small><button type="button" onClick={() => setNewFiles((files) => files.filter((_, itemIndex) => itemIndex !== index))} aria-label={`移除 ${file.name}`}><X size={15} /></button></div>
            ))}
          </div>
          {errorMessage && <p className="error-notice" role="alert">{errorMessage}</p>}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" className="detail-secondary-button" onClick={() => setIsEditing(false)} disabled={isSaving}><X size={17} />取消</button>
            <button type="submit" className="detail-save-button" disabled={!eventDate || !title.trim() || !detail.trim() || !category.trim() || isSaving}>
              {isSaving ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}
              儲存
            </button>
          </div>
        </form>
      ) : (
        <>
          <section className="detail-card">
            <div className="border-b border-stone-100 p-5 dark:border-white/10 sm:p-6">
              <time className="event-date !col-span-1" dateTime={event.date}>{event.date}</time>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-stone-950 dark:text-white">{event.title}</h2>
              <span className="event-category mt-3 inline-block">{event.category}</span>
            </div>

            <div className="p-5 sm:p-6">
              <p className="detail-label">Detail</p>
              <p className="whitespace-pre-wrap text-[15px] leading-7 text-stone-700 dark:text-stone-300">{event.detail}</p>

              <p className="detail-label mt-7">Tags</p>
              <div className="flex flex-wrap gap-2">
                {event.tags.length > 0 ? event.tags.map((tag) => <span className="tag-chip" key={tag}>{tag}</span>) : <span className="text-sm text-stone-400">No tags</span>}
              </div>

              {attachments.some(({ type }) => type === 'image') && (
                <>
                  <p className="detail-label mt-7">Photos</p>
                  <div className="photo-grid">
                    {attachments.filter(({ type }) => type === 'image').map((attachment) => attachmentUrls[attachment.id] ? (
                      <button type="button" key={attachment.id} onClick={() => setActivePhoto(attachment)} aria-label={`查看 ${attachment.filename}`}>
                        <img src={attachmentUrls[attachment.id]} alt={attachment.filename} />
                      </button>
                    ) : null)}
                  </div>
                </>
              )}

              {attachments.some(({ type }) => type !== 'image') && (
                <>
                  <p className="detail-label mt-7">Attachments</p>
                  <div className="attachment-list">
                    {attachments.filter(({ type }) => type !== 'image').map((attachment) => (
                      <div className="attachment-row" key={attachment.id}>
                        <FileText size={19} aria-hidden="true" />
                        <div className="min-w-0 flex-1"><strong>{attachment.filename}</strong><span>{attachment.mimeType} · {formatFileSize(attachment.size)}</span></div>
                        <button type="button" onClick={() => downloadAttachment(attachment)} aria-label={`下載 ${attachment.filename}`}><Download size={17} /></button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-7 grid grid-cols-2 gap-3">
                <div className="metric-card"><span>Attachments</span><strong>{attachments.filter(({ type }) => type !== 'image').length}</strong></div>
                <div className="metric-card"><span>Photos</span><strong>{attachments.filter(({ type }) => type === 'image').length}</strong></div>
              </div>
            </div>

            <dl className="detail-meta">
              <div><dt>Created</dt><dd>{formatDateTime(event.createdAt)}</dd></div>
              <div><dt>Updated</dt><dd>{formatDateTime(event.updatedAt)}</dd></div>
            </dl>
          </section>

          {errorMessage && <p className="error-notice" role="alert">{errorMessage}</p>}
          <button type="button" className="delete-event-button" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? <LoaderCircle size={18} className="animate-spin" /> : <Trash2 size={18} />}
            {isDeleting ? '刪除中' : '刪除事件'}
          </button>
          {activePhoto && attachmentUrls[activePhoto.id] && (
            <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={activePhoto.filename} onClick={() => setActivePhoto(null)}>
              <button type="button" onClick={() => setActivePhoto(null)} aria-label="關閉照片"><X size={22} /></button>
              <img src={attachmentUrls[activePhoto.id]} alt={activePhoto.filename} onClick={(clickEvent) => clickEvent.stopPropagation()} />
            </div>
          )}
        </>
      )}
    </main>
  )
}
