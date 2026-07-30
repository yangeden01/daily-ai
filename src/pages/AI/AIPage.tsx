import { CalendarDays, CircleAlert, LoaderCircle, LockKeyhole, Search, Sparkles, Tag } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { EventQueryOperation, EventQueryResult } from '../../models/EventQuery'
import { addSearchHistory, loadSearchHistory, saveSearchHistory } from '../../utils/searchHistory'
import { restoreListPosition, saveListPosition } from '../../utils/listPosition'
import { eventRepository } from '../../repositories'

const operationLabels: Record<EventQueryOperation, string> = {
  list: '列出事件',
  count: '計算筆數',
  sum: '金額合計',
  related: '相關事件',
}

const examples = [
  '所得稅',
  '家庭旅遊',
]

const currency = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 })

const answerFor = (result: EventQueryResult): string => {
  if (result.count === 0) return '找不到符合條件的事件。可以調整日期或減少篩選條件後再試一次。'
  if (result.query.operation === 'sum') return `找到 ${result.count} 筆事件，amount 金額合計為 ${currency.format(result.amountTotal)}。`
  if (result.query.operation === 'count') return `符合條件的事件共有 ${result.count} 筆。`
  return `找到 ${result.count} 筆相關事件。`
}

export default function AIPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryFromUrl = searchParams.get('q')?.trim() ?? ''
  const [input, setInput] = useState(queryFromUrl)
  const [result, setResult] = useState<EventQueryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unrecognized, setUnrecognized] = useState(false)
  const [searchHistory, setSearchHistory] = useState(loadSearchHistory)
  const [searchPhotos, setSearchPhotos] = useState(() => /照片/.test(queryFromUrl))
  const [searchFiles, setSearchFiles] = useState(() => /(附件|附檔)/.test(queryFromUrl))
  const [selectedTag, setSelectedTag] = useState(() => queryFromUrl.match(/#([^\s#，。？！]+)/)?.[1] ?? '')
  const [tagOptions, setTagOptions] = useState<string[]>([])

  useEffect(() => {
    eventRepository.getAll()
      .then((events) => setTagOptions([...new Set(events.flatMap((event) => event.tags).map((tag) => tag.trim()).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, 'zh-TW'))))
      .catch(() => setTagOptions([]))
  }, [])

  const executeQuery = useCallback(async (query: string) => {
    setSearchHistory((current) => {
      const next = addSearchHistory(current, query)
      saveSearchHistory(next)
      return next
    })
    setLoading(true)
    setError(null)
    setUnrecognized(false)
    try {
      const { localQueryEngine } = await import('../../services/query/LocalQueryEngine')
      const nextResult = await localQueryEngine.query(query)
      setResult(nextResult)
      setUnrecognized(nextResult === null)
    } catch (cause) {
      setResult(null)
      setError(cause instanceof Error ? cause.message : '本機查詢失敗，請稍後再試。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!queryFromUrl) return
    setInput(queryFromUrl)
    setSearchPhotos(/照片/.test(queryFromUrl))
    setSearchFiles(/(附件|附檔)/.test(queryFromUrl))
    setSelectedTag(queryFromUrl.match(/#([^\s#，。？！]+)/)?.[1] ?? '')
    void executeQuery(queryFromUrl)
  }, [executeQuery, queryFromUrl])

  const guidedQueryFor = (photos: boolean, files: boolean, tag: string) => {
    const attachmentQuery = photos && files ? '搜尋照片與附檔事件' : photos ? '搜尋照片事件' : files ? '搜尋附檔事件' : ''
    return [tag ? `#${tag}` : '', attachmentQuery].filter(Boolean).join(' ')
  }

  const updateGuidedSearch = (photos: boolean, files: boolean, tag: string) => {
    setSearchPhotos(photos)
    setSearchFiles(files)
    setSelectedTag(tag)
    setInput(guidedQueryFor(photos, files, tag))
  }

  const selectTagAndSearch = (tag: string) => {
    const query = guidedQueryFor(searchPhotos, searchFiles, tag)
    setSelectedTag(tag)
    setInput(query)
    if (!tag) return
    if (query === queryFromUrl) {
      void executeQuery(query)
      return
    }
    setSearchParams({ q: query })
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const query = input.trim()
    if (!query || loading) return
    if (query === queryFromUrl) {
      void executeQuery(query)
      return
    }
    setSearchParams({ q: query })
  }

  const repeatSearch = (query: string) => {
    setInput(query)
    if (query === queryFromUrl) {
      void executeQuery(query)
      return
    }
    setSearchParams({ q: query })
  }

  const searchRouteKey = `/ai?${searchParams.toString()}`

  useEffect(() => {
    if (result && !loading) restoreListPosition(searchRouteKey)
  }, [loading, result, searchRouteKey])

  return (
    <main className="page-enter pb-6">
      <section className="ai-compact-heading">
        <span className="ai-mark"><Sparkles size={30} strokeWidth={2.1} /></span>
        <div className="min-w-0">
          <h2>關鍵字查詢</h2>
          <p>搜尋目前裝置中的 Daily 事件</p>
          <div className="ai-privacy-note">
            <LockKeyhole size={12} />完全離線執行，不會上傳資料
          </div>
        </div>
      </section>

      <form className="ai-composer" onSubmit={handleSubmit}>
        <label htmlFor="ai-query" className="sr-only">輸入本機事件查詢</label>
        <textarea
          id="ai-query"
          className="ai-textarea"
          rows={2}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          enterKeyHint="enter"
          placeholder={'輸入關鍵字搜尋（Enter 換行）\n例如：所得稅'}
        />
        <div className="px-2 pt-3 text-sm leading-6 text-stone-600 dark:text-stone-300" aria-label="多關鍵詞搜尋規則">
          <p><strong>任一符合：</strong>以逗號分隔，例如「所得稅, 日本」</p>
          <p><strong>全部符合：</strong>以加號分隔，例如「所得稅 + 日本」</p>
        </div>
        <div className="ai-composer-actions">
          <span className="text-sm font-medium text-stone-500 dark:text-stone-400">搜尋結果如下</span>
          <button type="submit" className="send-button" aria-label="送出本機查詢" disabled={!input.trim() || loading}>
            {loading && <LoaderCircle size={18} className="animate-spin" />}
            <span>查詢</span>
          </button>
        </div>
      </form>

      <fieldset className="search-filter-panel">
        <legend className="sr-only">附件類型搜尋</legend>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-300">
          <input type="checkbox" className="h-5 w-5 rounded border-stone-300 accent-indigo-600" checked={searchPhotos} onChange={(event) => updateGuidedSearch(event.target.checked, searchFiles, selectedTag)} />
          搜尋照片事件
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-300">
          <input type="checkbox" className="h-5 w-5 rounded border-stone-300 accent-indigo-600" checked={searchFiles} onChange={(event) => updateGuidedSearch(searchPhotos, event.target.checked, selectedTag)} />
          搜尋附檔事件
        </label>
        <label className="inline-flex min-w-44 flex-1 items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-300">
          <Tag size={17} aria-hidden="true" />
          <span className="shrink-0">搜尋 Tag</span>
          <select className="search-tag-select" value={selectedTag} onChange={(event) => selectTagAndSearch(event.target.value)}>
            <option value="">全部 Tags</option>
            {tagOptions.map((tag) => <option value={tag} key={tag}>{tag}</option>)}
          </select>
        </label>
      </fieldset>

      {searchHistory.length > 0 && (
        <section className="mt-4 px-1" aria-label="最近搜尋">
          <p className="section-label">最近搜尋</p>
          <div className="flex flex-wrap gap-2">
            {searchHistory.map((query) => (
              <button
                key={query}
                type="button"
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:border-indigo-300 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-white/10 dark:bg-stone-900 dark:text-stone-300"
                onClick={() => repeatSearch(query)}
              >
                {query}
              </button>
            ))}
          </div>
        </section>
      )}

      {loading && (
        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-stone-500" role="status">
          <LoaderCircle size={17} className="animate-spin" />正在查詢本機事件…
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
            <p className="section-label !mb-0 !px-0 text-indigo-600 dark:text-indigo-300">查詢結果</p>
            <p className="mt-2 text-lg font-semibold leading-7 text-stone-950 dark:text-white">{answerFor(result)}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"><Search size={13} />{operationLabels[result.query.operation]}</span>
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
                <h3 className="font-semibold text-stone-900 dark:text-white">相關事件</h3>
                <span className="text-sm text-stone-500">{result.count} 筆</span>
              </div>
              <div className="space-y-3">
                {result.events.map((event) => (
                  <Link
                    key={event.id}
                    to={`/daily/${event.id}`}
                    state={{ returnTo: `/ai?${searchParams.toString()}`, returnLabel: 'Search' }}
                    data-event-id={event.id}
                    onClick={() => saveListPosition(searchRouteKey, event.id)}
                    className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-white/10 dark:bg-stone-900 dark:hover:border-indigo-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-stone-500 dark:text-stone-400">{event.date}</p>
                        <h4 className="mt-1 truncate font-semibold text-stone-950 dark:text-white">{event.title}</h4>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-stone-600 dark:text-stone-300">{event.detail}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600 dark:bg-white/10 dark:text-stone-300">{event.category}</span>
                    </div>
                    {event.amount !== undefined && <p className="mt-3 text-sm font-semibold text-indigo-600 dark:text-indigo-300">{currency.format(event.amount)}</p>}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
