interface CategoryFieldProps {
  id: string
  value: string
  options: string[]
  onChange: (value: string) => void
}

export function CategoryField({ id, value, options, onChange }: CategoryFieldProps) {
  return (
    <>
      <label className="detail-field-label mt-5" htmlFor={id}>分類</label>
      <div className="category-composer mt-2">
        <label className="category-input-field" htmlFor={id}>
          <input
            id={id}
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="輸入新增分類或點選現有分類如下"
            autoComplete="off"
          />
        </label>
        {options.length > 0 && (
          <div className="category-options-panel" aria-label="資料分類">
            <div className="category-options-heading">
              <span>資料分類</span>
              <small>{options.length} 個分類</small>
            </div>
            <div className="category-options-list">
              {options.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={`category-option ${value === option ? 'category-option-active' : ''}`}
                  onClick={() => onChange(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
