import { CalendarDays, CircleAlert, LoaderCircle, LockKeyhole, Moon, Search, Sparkles, Sun, Tag, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { EventQueryOperation, EventQueryResult } from '../../models/EventQuery'
import { addSearchHistory, loadLastSearchFilter, loadSearchHistory, saveLastSearchFilter, saveSearchHistory } from '../../utils/searchHistory'
import { restoreListPosition, saveListPosition } from '../../utils/listPosition'
import { eventRepository } from '../../repositories'
import { appModeFromSearch, routeForMode } from '../../utils/appMode'
import { isAnniversaryEvent, isDailyEvent, isFutureDailyEvent, isNoteEvent, isTodoNote, sortNotes, type NoteSort } from '../../utils/noteEvents'
import { sortEventsNewestFirst } from '../../utils/sortEvents'
import { formatLunarDateText, formatSolarMonthDay, getEventMonth, sortAnniversaries } from '../../utils/anniversary'
import { LinkifiedText } from '../../components/LinkifiedText'

const operationLabels: Record<EventQueryOperation, string> = {
  list: '列出事件',
  count: '計算筆數',
  sum: '金額合計',
  related: '相關事件',
}

const operationLabelFor = (operation: EventQueryOperation, isNotesMode: boolean, isAnniversaryMode: boolean) => {
  if (isAnniversaryMode) {
    if (operation === 'list') return '列出紀念日'
    if (operation === 'related') return '相關紀念日'
    return operationLabels[operation]
  }
  if (!isNotesMode) return operationLabels[operation]
  if (operation === 'list') return '列出記事'
  if (operation === 'related') return '相關記事'
  return operationLabels[operation]
}

const examples = [
  '生日',
  '結婚紀念日',
]

const currency = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 })

const answerFor = (result: EventQueryResult, isNotesMode = false, isAnniversaryMode = false): string => {
  const itemLabel = isAnniversaryMode ? '紀念日' : isNotesMode ? '記事' : '事件'
  if (result.count === 0) return `找不到符合條件的${itemLabel}。可以減少篩選條件後再試一次。`
  if (result.query.operation === 'sum') return `找到 ${result.count} 筆${itemLabel}，amount 金額合計為 ${currency.format(result.amountTotal)}。`
  if (result.query.operation === 'count') return `符合條件的${itemLabel}共有 ${result.count} 筆。`
  if (!result.query.criteria.keyword && !result.query.criteria.tag && !result.query.criteria.attachmentKind && !result.query.criteria.dateFrom && !result.query.criteria.dateTo) {
    if (result.query.criteria.category) {
      return `分類「${result.query.criteria.category}」共有 ${result.count} 筆${itemLabel}。`
    }
    return `目前共有 ${result.count} 筆${itemLabel}。`
  }
  return `找到 ${result.count} 筆相關${itemLabel}。`
}

export default function AIPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const mode = appModeFromSearch(`?${searchParams.toString()}`)
  const isNotesMode = mode === 'notes'
  const isAnniversaryMode = mode === 'anniversary'
  const rawQueryFromUrl = searchParams.get('q')
  const rawCategoryFromUrl = searchParams.get('category')
  const hasExplicitFilterInUrl = rawQueryFromUrl !== null || rawCategoryFromUrl !== null
  const savedFilter = !hasExplicitFilterInUrl ? loadLastSearchFilter(mode) : null
  const queryFromUrl = (rawQueryFromUrl !== null ? rawQueryFromUrl.trim() : (savedFilter?.query || (savedFilter?.tag ? `#${savedFilter.tag}` : '')))
  const categoryFromUrl = (rawCategoryFromUrl !== null ? rawCategoryFromUrl.trim() : (savedFilter?.category || ''))
  const [input, setInput] = useState(queryFromUrl)
  const [result, setResult] = useState<EventQueryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unrecognized, setUnrecognized] = useState(false)
  const [searchHistory, setSearchHistory] = useState(() => loadSearchHistory(mode))
  const [searchPhotos, setSearchPhotos] = useState(() => /照片/.test(queryFromUrl))
  const [searchFiles, setSearchFiles] = useState(() => /(附件|附檔)/.test(queryFromUrl))
  const [selectedTag, setSelectedTag] = useState(() => queryFromUrl.match(/#([^\s#，。？！]+)/)?.[1] ?? savedFilter?.tag ?? '')
  const [selectedCategory, setSelectedCategory] = useState(categoryFromUrl)
  const [availableEvents, setAvailableEvents] = useState<import('../../models/Event').Event[]>([])
  const [noteSort, setNoteSort] = useState<NoteSort | null>(() => /頻繁更新記事/.test(queryFromUrl) ? 'frequent' : /最近更新記事/.test(queryFromUrl) ? 'recent' : null)

  const [refreshNonce, setRefreshNonce] = useState(0)

  useEffect(() => {
    eventRepository.getAll()
      .then((events) => {
        const visibleEvents = events.filter(
          isAnniversaryMode ? isAnniversaryEvent : isNotesMode ? isNoteEvent : isDailyEvent
        )
        setAvailableEvents(visibleEvents)
      })
      .catch(() => {
        setAvailableEvents([])
      })
  }, [isAnniversaryMode, isNotesMode])

  const categoryOptions = [...new Set(availableEvents.map((event) => event.category.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'zh-TW'))

  const isCategoryValid = !selectedCategory || categoryOptions.length === 0 || categoryOptions.includes(selectedCategory)
  const activeCategory = isCategoryValid ? selectedCategory : ''

  const tagOptions = [...new Set(
    (activeCategory
      ? availableEvents.filter((event) => event.category.trim().toLocaleLowerCase() === activeCategory.trim().toLocaleLowerCase())
      : availableEvents
    ).flatMap((event) => event.tags).map((tag) => tag.trim()).filter(Boolean)
  )].sort((left, right) => left.localeCompare(right, 'zh-TW'))

  const isTagValid = !selectedTag || tagOptions.length === 0 || tagOptions.includes(selectedTag)
  const activeTag = isTagValid ? selectedTag : ''

  useEffect(() => {
    const rawQ = searchParams.get('q')
    const rawCat = searchParams.get('category')
    const hasExplicit = rawQ !== null || rawCat !== null
    const currentSaved = !hasExplicit ? loadLastSearchFilter(mode) : null
    const effectiveQuery = rawQ !== null ? rawQ.trim() : (currentSaved?.query || (currentSaved?.tag ? `#${currentSaved.tag}` : ''))
    const effectiveCategory = rawCat !== null ? rawCat.trim() : (currentSaved?.category || '')

    setSearchHistory(loadSearchHistory(mode))
    setInput(effectiveQuery)
    setError(null)
    setUnrecognized(false)
    setSearchPhotos(/照片/.test(effectiveQuery))
    setSearchFiles(/(附件|附檔)/.test(effectiveQuery))
    const tagMatch = effectiveQuery.match(/#([^\s#，。？！]+)/)?.[1] ?? (currentSaved?.tag || '')
    setSelectedTag(tagMatch)
    setSelectedCategory(effectiveCategory)
    const detectedNoteSort: NoteSort | null = /頻繁更新記事/.test(effectiveQuery)
      ? 'frequent'
      : /最近更新記事/.test(effectiveQuery)
        ? 'recent'
        : null
    setNoteSort(detectedNoteSort)

    let cancelled = false
    setLoading(true)

    const runQuery = async () => {
      try {
        const explicitSort = /頻繁更新記事/.test(effectiveQuery)
          ? 'frequent'
          : /最近更新記事/.test(effectiveQuery)
            ? 'recent'
            : null
        const queryWithoutSort = effectiveQuery
          .replace(/(?:頻繁|最近)更新記事/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        let nextResult: EventQueryResult | null = null

        if (queryWithoutSort) {
          const { localQueryEngine } = await import('../../services/query/LocalQueryEngine')
          nextResult = await localQueryEngine.query(queryWithoutSort)
        } else {
          const events = await eventRepository.getAll()
          nextResult = {
            query: {
              rawText: effectiveCategory ? `分類：${effectiveCategory}` : '全部',
              operation: 'list',
              criteria: effectiveCategory ? { category: effectiveCategory } : {},
            },
            events,
            count: events.length,
            amountTotal: 0,
          }
        }

        if (isNotesMode && explicitSort && !queryWithoutSort) {
          const allNotes = (await eventRepository.getAll()).filter(isNoteEvent)
          const noteEvents = sortNotes(allNotes, explicitSort)
          nextResult = {
            query: { rawText: effectiveQuery, operation: 'list', criteria: {} },
            events: noteEvents,
            count: noteEvents.length,
            amountTotal: 0,
          }
        }

        if (nextResult) {
          const visible = nextResult.events
            .filter(isAnniversaryMode ? isAnniversaryEvent : isNotesMode ? isNoteEvent : isDailyEvent)
            .filter((event) => !effectiveCategory || event.category.trim().toLocaleLowerCase() === effectiveCategory.toLocaleLowerCase())
          const activeSort = explicitSort ?? detectedNoteSort
          let ordered = visible
          if (isNotesMode) {
            ordered = sortNotes(visible, activeSort ?? 'recent')
          } else if (isAnniversaryMode) {
            ordered = sortAnniversaries(visible)
          } else {
            ordered = sortEventsNewestFirst(visible)
          }
          nextResult = {
            ...nextResult,
            query: { ...nextResult.query, criteria: { ...nextResult.query.criteria, ...(effectiveCategory ? { category: effectiveCategory } : {}) } },
            events: ordered,
            count: ordered.length,
            amountTotal: ordered.reduce((sum, event) => sum + (event.amount ?? 0), 0),
          }
        }

        if (!cancelled) {
          setResult(nextResult)
          setUnrecognized(nextResult === null)
          setError(null)
          if (effectiveQuery) {
            setSearchHistory((current) => {
              const next = addSearchHistory(current, effectiveQuery)
              saveSearchHistory(next, mode)
              return next
            })
          }
          saveLastSearchFilter(mode, {
            category: effectiveCategory,
            tag: tagMatch,
            query: effectiveQuery,
          })
        }
      } catch (cause) {
        if (!cancelled) {
          setResult(null)
          setError(cause instanceof Error ? cause.message : '本機查詢失敗，請稍後再試。')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void runQuery()

    return () => {
      cancelled = true
    }
  }, [isAnniversaryMode, isNotesMode, mode, searchParams, refreshNonce])

  const updateQueryParams = (query: string, category = activeCategory, tagOverride?: string) => {
    const extractedTag = tagOverride !== undefined
      ? tagOverride
      : (query.match(/#([^\s#，。？！]+)/)?.[1] ?? '')
    saveLastSearchFilter(mode, {
      category,
      tag: extractedTag,
      query,
    })
    const next = new URLSearchParams(searchParams)
    if (query) next.set('q', query)
    else next.delete('q')
    if (category) next.set('category', category)
    else next.delete('category')
    setSearchParams(next)
  }

  const triggerRefresh = () => {
    setRefreshNonce((n) => n + 1)
  }

  const guidedQueryFor = (photos: boolean, files: boolean, tag: string) => {
    const itemLabel = isAnniversaryMode ? '紀念日' : isNotesMode ? '記事' : '事件'
    return [
      tag ? `#${tag}` : '',
      photos ? `搜尋照片${itemLabel}` : '',
      files ? `搜尋附檔${itemLabel}` : '',
    ].filter(Boolean).join('；')
  }

  const noteSortQueryFor = (sort: NoteSort | null) => sort === 'recent'
    ? '最近更新記事'
    : sort === 'frequent'
      ? '頻繁更新記事'
      : ''

  const composedGuidedQueryFor = (photos: boolean, files: boolean, tag: string, sort: NoteSort | null) => [
    isNotesMode ? noteSortQueryFor(sort) : '',
    guidedQueryFor(photos, files, tag),
  ].filter(Boolean).join('；')

  const updateGuidedSearch = (photos: boolean, files: boolean, tag: string) => {
    setSearchPhotos(photos)
    setSearchFiles(files)
    setSelectedTag(tag)
    const nextQuery = composedGuidedQueryFor(photos, files, tag, noteSort)
    setInput(nextQuery)
    if (nextQuery === queryFromUrl && activeCategory === categoryFromUrl) {
      saveLastSearchFilter(mode, {
        category: activeCategory,
        tag,
        query: nextQuery,
      })
      triggerRefresh()
      return
    }
    updateQueryParams(nextQuery, activeCategory, tag)
  }

  const selectTagAndSearch = (tag: string) => {
    const query = composedGuidedQueryFor(searchPhotos, searchFiles, tag, noteSort)
    setSelectedTag(tag)
    setInput(query)
    if (query === queryFromUrl && activeCategory === categoryFromUrl) {
      saveLastSearchFilter(mode, {
        category: activeCategory,
        tag,
        query,
      })
      triggerRefresh()
      return
    }
    updateQueryParams(query, activeCategory, tag)
  }

  const selectCategoryAndSearch = (category: string) => {
    setSelectedCategory(category)
    let nextTag = activeTag
    let nextInput = input

    if (category && activeTag) {
      const validTags = new Set(
        availableEvents
          .filter((event) => event.category.trim().toLocaleLowerCase() === category.trim().toLocaleLowerCase())
          .flatMap((event) => event.tags)
          .map((tag) => tag.trim())
      )
      if (!validTags.has(activeTag)) {
        nextTag = ''
        setSelectedTag('')
        nextInput = nextInput
          .replace(new RegExp(`#${activeTag}(?:[\\s；;,]+|$)`, 'g'), '')
          .replace(/^[；;,\\s]+|[；;,\\s]+$/g, '')
          .trim()
        setInput(nextInput)
      }
    }

    if (nextInput.trim() === queryFromUrl && category === categoryFromUrl) {
      saveLastSearchFilter(mode, {
        category,
        tag: nextTag,
        query: nextInput.trim(),
      })
      triggerRefresh()
      return
    }
    updateQueryParams(nextInput.trim(), category, nextTag)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const query = input.trim()
    if (loading) return
    if (query === queryFromUrl && activeCategory === categoryFromUrl) {
      saveLastSearchFilter(mode, {
        category: activeCategory,
        tag: activeTag,
        query,
      })
      triggerRefresh()
      return
    }
    updateQueryParams(query, activeCategory, activeTag)
  }

  const repeatSearch = (query: string) => {
    setInput(query)
    if (query === queryFromUrl && activeCategory === categoryFromUrl) {
      triggerRefresh()
      return
    }
    updateQueryParams(query, activeCategory)
  }

  const selectNoteSort = (sort: NoteSort) => {
    if (noteSort === sort) {
      setNoteSort(null)
      const query = composedGuidedQueryFor(searchPhotos, searchFiles, activeTag, null)
      setInput(query)
      setResult(null)
      setError(null)
      setUnrecognized(false)
      updateQueryParams(query, activeCategory, activeTag)
      return
    }
    setNoteSort(sort)
    const query = composedGuidedQueryFor(searchPhotos, searchFiles, activeTag, sort)
    setInput(query)
    updateQueryParams(query, activeCategory, activeTag)
  }

  const searchRouteKey = `/ai?${searchParams.toString()}`

  useEffect(() => {
    if (result && !loading) restoreListPosition(searchRouteKey)
  }, [loading, result, searchRouteKey])

  const itemLabel = isAnniversaryMode ? '紀念日' : isNotesMode ? '記事' : '事件'

  return (
    <main className="page-enter pb-6">
      <section className="ai-compact-heading">
        <span className="ai-mark"><Sparkles size={30} strokeWidth={2.1} /></span>
        <div className="min-w-0">
          <h2>{isAnniversaryMode ? '紀念日搜尋(關鍵字)' : isNotesMode ? '記事搜尋(關鍵字)' : '日常事件搜尋(關鍵字)'}</h2>
          <p>搜尋目前裝置中的 {isAnniversaryMode ? 'Anniversary 紀念日' : isNotesMode ? 'Notes 記事' : 'Daily 事件'}</p>
          <div className="ai-privacy-note">
            <LockKeyhole size={12} />完全離線執行，不會上傳資料
          </div>
        </div>
      </section>

      <form className="ai-composer" onSubmit={handleSubmit}>
        {/* 搜尋分類與 Tag */}
        <div className="search-refine-panel !border-b !border-t-0 !pt-0 !pb-3 border-stone-200 dark:border-stone-800">
          <label className="search-category-action">
            <span className="shrink-0 font-medium">搜尋分類</span>
            <select className="search-category-select" value={activeCategory} onChange={(event) => selectCategoryAndSearch(event.target.value)}>
              <option value="">全部分類</option>
              {categoryOptions.map((category) => <option value={category} key={category}>{category}</option>)}
            </select>
          </label>
          <div className="ai-composer-actions">
            <label className="search-tag-action">
              <Tag size={19} aria-hidden="true" />
              <span className="shrink-0">搜尋 Tag</span>
              <select className="search-tag-select" value={activeTag} onChange={(event) => selectTagAndSearch(event.target.value)}>
                <option value="">{activeCategory ? `${activeCategory} 的全部 Tags` : '全部 Tags'}</option>
                {tagOptions.map((tag) => <option value={tag} key={tag}>{tag}</option>)}
              </select>
            </label>
            {activeTag && (
              <button
                type="button"
                onClick={() => selectTagAndSearch('')}
                className="text-xs px-1.5 py-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                title="清除 Tag"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <label htmlFor="ai-query" className="sr-only">輸入本機{itemLabel}查詢</label>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              id="ai-query"
              type="text"
              className="ai-search-input !mt-0 !pr-9"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              enterKeyHint="search"
              placeholder="輸入關鍵字"
            />
            {input && (
              <button
                type="button"
                className="clear-field-button !right-2"
                onClick={() => {
                  setInput('')
                  if (queryFromUrl) {
                    updateQueryParams('', selectedCategory)
                  }
                }}
                aria-label="清除搜尋關鍵字"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="search-submit-btn"
            aria-label="送出本機查詢"
            disabled={loading}
          >
            {loading ? <LoaderCircle size={18} className="animate-spin" /> : <Search size={18} />}
            <span className="text-sm font-bold">查詢</span>
          </button>
        </div>

        <div className="px-2 pt-2.5 text-sm leading-6 text-stone-600 dark:text-stone-300" aria-label="多關鍵詞搜尋規則">
          <p><strong>任一符合：</strong>以逗號分隔，例如「生日, 聚餐」</p>
          <p><strong>全部符合：</strong>以加號分隔，例如「生日 + 家人」</p>
        </div>

        {searchHistory.length > 0 && (
          <div className="mt-3 px-1" aria-label="最近搜尋">
            <p className="section-label !mb-2">最近搜尋</p>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((query) => (
                <button
                  key={query}
                  type="button"
                  className="search-history-chip rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:border-indigo-300 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-white/10 dark:bg-stone-900 dark:text-stone-300"
                  onClick={() => repeatSearch(query)}
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}

        <fieldset className="search-filter-panel search-filter-panel-in-composer">
          <legend className="sr-only">搜尋篩選</legend>
          {isNotesMode && (
            <div className="search-note-sort">
              <span className="search-note-sort-label">記事排序</span>
              <div className="note-sort-switch !mb-0" role="group" aria-label="記事排序方式，可不選">
                <button type="button" aria-pressed={noteSort === 'frequent'} className={noteSort === 'frequent' ? 'active' : ''} onClick={() => selectNoteSort('frequent')}>
                  頻繁更新
                </button>
                <button type="button" aria-pressed={noteSort === 'recent'} className={noteSort === 'recent' ? 'active' : ''} onClick={() => selectNoteSort('recent')}>
                  最近更新
                </button>
              </div>
            </div>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-300">
            <input type="checkbox" className="search-checkbox h-5 w-5 rounded border-stone-300 accent-indigo-600" checked={searchPhotos} onChange={(event) => updateGuidedSearch(event.target.checked, searchFiles, selectedTag)} />
            搜尋照片{itemLabel}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-300">
            <input type="checkbox" className="search-checkbox h-5 w-5 rounded border-stone-300 accent-indigo-600" checked={searchFiles} onChange={(event) => updateGuidedSearch(searchPhotos, event.target.checked, selectedTag)} />
            搜尋附檔{itemLabel}
          </label>
        </fieldset>
      </form>

      <p className="search-results-heading">搜尋結果如下</p>

      {loading && (
        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-stone-500" role="status">
          <LoaderCircle size={17} className="animate-spin" />正在查詢本機{itemLabel}…
        </div>
      )}

      {error && (
        <div className="error-notice mt-5" role="alert"><CircleAlert size={17} /><span>{error}</span></div>
      )}

      {unrecognized && (
        <section className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
          <h3 className="font-semibold text-amber-900 dark:text-amber-200">目前無法理解這個問法</h3>
          <p className="mt-1 text-sm leading-6 text-amber-700 dark:text-amber-300">這是規則式本機查詢，不是真正的生成式 AI。可以試試：</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {examples.map((example) => (
              <button key={example} type="button" className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-left text-xs text-amber-800 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-800 dark:bg-stone-900 dark:text-amber-200" onClick={() => setInput(example)}>
                {example}
              </button>
            ))}
          </div>
        </section>
      )}

      {result && !loading && (
        <section className="mt-6 space-y-4" aria-live="polite">
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-stone-900">
            <p className="section-label search-result-title !mb-0 !px-0">查詢結果</p>
            <p className="mt-2 text-lg font-semibold leading-7 text-stone-950 dark:text-white">{answerFor(result, isNotesMode, isAnniversaryMode)}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="search-result-op-tag inline-flex items-center gap-1 rounded-full px-3 py-1.5"><Search size={13} />{operationLabelFor(result.query.operation, isNotesMode, isAnniversaryMode)}</span>
              {(result.query.criteria.dateFrom || result.query.criteria.dateTo) && <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1.5 text-stone-700 dark:bg-white/10 dark:text-stone-300"><CalendarDays size={13} />{result.query.dateLabel ?? `${result.query.criteria.dateFrom}～${result.query.criteria.dateTo}`}</span>}
              {result.query.criteria.category && <span className="rounded-full bg-stone-100 px-3 py-1.5 text-stone-700 dark:bg-white/10 dark:text-stone-300">Category：{result.query.criteria.category}</span>}
              {result.query.criteria.tag && <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1.5 text-stone-700 dark:bg-white/10 dark:text-stone-300"><Tag size={13} />{result.query.criteria.tag}</span>}
              {result.query.criteria.keyword && <span className="rounded-full bg-stone-100 px-3 py-1.5 text-stone-700 dark:bg-white/10 dark:text-stone-300">關鍵字：{result.query.criteria.keyword}{result.query.criteria.keywordMode === 'any' ? '（任一）' : result.query.criteria.keywordMode === 'all' ? '（全部）' : ''}</span>}
              {result.query.criteria.attachmentKind && <span className="rounded-full bg-stone-100 px-3 py-1.5 text-stone-700 dark:bg-white/10 dark:text-stone-300">{result.query.criteria.attachmentKind === 'photo' ? '含照片' : result.query.criteria.attachmentKind === 'file' ? '含附件' : '含照片或附件'}</span>}
            </div>
          </div>

          {result.events.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="font-semibold text-stone-900 dark:text-white">相關{itemLabel}</h3>
                <span className="text-sm text-stone-500">{result.count} 筆</span>
              </div>
              <div className="space-y-3">
                {result.events.map((event) => {
                  const isLunar = event.calendarType === 'lunar'
                  const lunarText = isLunar && event.lunarMonth && event.lunarDay
                    ? formatLunarDateText(event.lunarMonth, event.lunarDay, event.isLeapMonth)
                    : null
                  const eventMonth = getEventMonth(event)
                  const isFuture = !isAnniversaryMode && !isNotesMode && isFutureDailyEvent(event)
                  const isTodo = isNotesMode && isTodoNote(event)
                  const monthClass = isTodo
                    ? 'search-card-todo'
                    : isFuture
                      ? 'search-card-future'
                      : (eventMonth % 2 === 0 ? 'search-card-month-even' : 'search-card-month-odd')
                  return (
                    <Link
                      key={event.id}
                      to={routeForMode(`/daily/${event.id}`, mode)}
                      state={{ returnTo: `/ai?${searchParams.toString()}`, returnLabel: 'Search' }}
                      data-event-id={event.id}
                      onClick={() => saveListPosition(searchRouteKey, event.id)}
                      className={`block rounded-2xl p-4 ${monthClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {isAnniversaryMode ? (
                            <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                              <span className={`inline-flex items-center gap-1 font-medium ${isLunar ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {isLunar ? <Moon size={12} /> : <Sun size={12} />}
                                {isLunar ? (lunarText ?? '農曆') : `國曆 ${formatSolarMonthDay(event.date)}`}
                              </span>
                            </div>
                          ) : isNotesMode ? (
                            <div className="flex items-center gap-1.5">
                              <p className={isTodo ? "text-xs font-bold text-rose-700 dark:text-rose-300" : "text-xs text-stone-500 dark:text-stone-400"}>
                                修改於 {new Date(event.lastEditedAt ?? event.updatedAt).toLocaleDateString('zh-TW')}
                              </p>
                              {isTodo && <span className="event-todo-badge">待做</span>}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <p className={isFuture ? "text-xs font-bold text-amber-700 dark:text-amber-300" : "text-xs text-stone-500 dark:text-stone-400"}>{event.date}</p>
                              {isFuture && <span className="event-future-badge">未來</span>}
                            </div>
                          )}
                          <h4 className={`mt-1 truncate font-semibold ${isTodo ? 'text-rose-950 dark:text-rose-100 font-bold' : isFuture ? 'text-amber-950 dark:text-amber-100' : 'text-stone-950 dark:text-white'}`}><LinkifiedText text={event.title} /></h4>
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-stone-600 dark:text-stone-300"><LinkifiedText text={event.detail} /></p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isTodo
                            ? 'bg-rose-200/80 text-rose-900 dark:bg-rose-500/25 dark:text-rose-300'
                            : isFuture
                              ? 'bg-amber-200/70 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300'
                              : 'bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-stone-300'
                        }`}>{event.category}</span>
                      </div>
                      {event.amount !== undefined && <p className="mt-3 text-sm font-semibold text-indigo-600 dark:text-indigo-300">{currency.format(event.amount)}</p>}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
