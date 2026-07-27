import { ArrowUp, Sparkles } from 'lucide-react'

export default function AIPage() {
  return (
    <main className="page-enter flex min-h-[calc(100dvh-13rem)] flex-col justify-center">
      <section className="mb-7 text-center">
        <span className="ai-mark"><Sparkles size={27} /></span>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-stone-950 dark:text-white">今天想查什麼？</h2>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">從你的 Daily 中尋找答案</p>
      </section>

      <section className="ai-composer">
        <label htmlFor="ai-query" className="sr-only">輸入查詢</label>
        <textarea
          id="ai-query"
          className="ai-textarea"
          placeholder={'今天想查什麼？\n\n例如：\n我今年所得稅多少？\n去年去了幾次日本？'}
        />
        <div className="flex items-center justify-between border-t border-stone-100 px-3 pt-3 dark:border-white/10">
          <span className="px-1 text-xs text-stone-400">Daily AI</span>
          <button type="button" className="send-button" aria-label="送出查詢"><ArrowUp size={19} /></button>
        </div>
      </section>
    </main>
  )
}
