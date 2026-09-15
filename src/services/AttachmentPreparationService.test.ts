import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareSelectedAttachments } from './AttachmentPreparationService'

describe('prepareSelectedAttachments', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size },
    })
  })

  it('保留通過驗證的原始檔案', async () => {
    const file = new File(['content'], 'note.txt', { type: 'text/plain' })

    await expect(prepareSelectedAttachments([file])).resolves.toEqual([file])
  })

  it('拒絕危險的可執行檔案', async () => {
    const file = new File(['content'], 'unsafe.exe', { type: 'application/x-msdownload' })

    await expect(prepareSelectedAttachments([file])).rejects.toThrow('不允許的可執行檔類型')
  })
})
