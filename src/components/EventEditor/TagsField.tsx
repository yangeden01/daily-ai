import type { KeyboardEventHandler } from 'react'
import { Plus, Tag, X } from 'lucide-react'

interface TagsFieldProps {
  id: string
  tags: string[]
  inputValue: string
  options: string[]
  onInputChange: (value: string) => void
  onInputKeyDown: KeyboardEventHandler<HTMLInputElement>
  onInputBlur: () => void
  onRemoveTag: (tag: string) => void
  onOptionSelect: (tag: string) => void
}

export function TagsField({
  id,
  tags,
  inputValue,
  options,
  onInputChange,
  onInputKeyDown,
  onInputBlur,
  onRemoveTag,
  onOptionSelect,
}: TagsFieldProps) {
  return (
    <>
      <label className="detail-field-label mt-5" htmlFor={id}>Tags</label>
      <div className="tag-editor">
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span className="editable-tag" key={tag}>
              {tag}
              <button type="button" onClick={() => onRemoveTag(tag)} aria-label={`移除 ${tag}`}>
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
        <div className="tag-input-row">
          <Plus size={16} aria-hidden="true" />
          <input
            id={id}
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            onBlur={onInputBlur}
            placeholder="輸入 Tag，按 Enter 或逗號新增"
          />
        </div>
        {options.length > 0 && (
          <label className="existing-tag-select">
            <Tag size={16} aria-hidden="true" />
            <span>選擇既有 Tag</span>
            <select
              defaultValue=""
              onChange={(event) => {
                if (!event.target.value) return
                onOptionSelect(event.target.value)
                event.target.value = ''
              }}
            >
              <option value="">請選擇</option>
              {options.map((tag) => (
                <option value={tag} key={tag} disabled={tags.includes(tag)}>{tag}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="mt-2 text-xs leading-5 text-stone-400">空白與重複的 Tags 會自動移除。</p>
    </>
  )
}
