import { describe, expect, it } from 'vitest'
import { MAX_ATTACHMENT_SIZE, validateAttachmentFile } from './attachments'

describe('validateAttachmentFile', () => {
  it('accepts regular files within 10 MB', () => {
    expect(validateAttachmentFile(new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }))).toBeNull()
  })

  it('rejects oversized and dangerous executable files', () => {
    const oversized = new File([new Uint8Array(MAX_ATTACHMENT_SIZE + 1)], 'large.pdf')
    expect(validateAttachmentFile(oversized)).toContain('10 MB')
    expect(validateAttachmentFile(new File(['x'], 'setup.EXE'))).toContain('不允許')
    expect(validateAttachmentFile(new File(['x'], 'renamed.txt', { type: 'application/x-msdownload' }))).toContain('不允許')
  })
})
