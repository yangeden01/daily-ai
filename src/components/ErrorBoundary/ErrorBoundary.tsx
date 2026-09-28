import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">畫面載入發生問題</h2>
          <p className="mt-2 max-w-sm text-xs text-stone-500 dark:text-stone-400">
            應用程式遇到非預期的渲染異常，您可以點選下方按鈕重新載入畫面。
          </p>
          {this.state.error?.message && (
            <p className="mt-2 max-w-sm rounded-lg bg-stone-100 p-2 font-mono text-[11px] text-stone-600 dark:bg-stone-800 dark:text-stone-300">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
          >
            <RotateCcw size={14} />
            <span>重新載入</span>
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
