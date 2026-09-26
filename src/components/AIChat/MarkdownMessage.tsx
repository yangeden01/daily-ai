import React from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Calendar } from 'lucide-react'

interface Props {
  content: string
}

export const MarkdownMessage: React.FC<Props> = ({ content }) => {
  // Simple, robust Markdown parser for chat messages without heavy extra dependencies
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []

  let inTable = false
  let tableHeader: string[] = []
  let tableRows: string[][] = []

  const flushTable = (keyPrefix: string) => {
    if (!inTable) return
    elements.push(
      <div key={`table-${keyPrefix}`} className="my-3 overflow-x-auto rounded-xl border border-stone-200 bg-white/70 shadow-sm dark:border-white/10 dark:bg-stone-900/60">
        <table className="w-full text-left text-xs sm:text-sm">
          {tableHeader.length > 0 && (
            <thead className="border-b border-stone-200 bg-stone-100/80 font-bold text-stone-900 dark:border-white/10 dark:bg-stone-800/80 dark:text-stone-100">
              <tr>
                {tableHeader.map((th, i) => (
                  <th key={i} className="px-3 py-2">
                    {renderInline(th.trim())}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-stone-100 dark:divide-white/5">
            {tableRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3 py-2 text-stone-700 dark:text-stone-300">
                    {renderInline(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
    inTable = false
    tableHeader = []
    tableRows = []
  }

  const renderInline = (text: string): React.ReactNode => {
    // 1. Process custom event links: [title](event:ID)
    const eventLinkRegex = /\[([^\]]+)\]\(event:([a-zA-Z0-9_-]+)\)/g
    const parts: React.ReactNode[] = []
    let lastIdx = 0
    let match: RegExpExecArray | null

    while ((match = eventLinkRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(renderFormatting(text.slice(lastIdx, match.index)))
      }
      const label = match[1]
      const eventId = match[2]
      parts.push(
        <Link
          key={`evt-${match.index}`}
          to={`/daily/${eventId}`}
          className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 hover:underline dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
        >
          <Calendar size={12} />
          <span>{label}</span>
        </Link>
      )
      lastIdx = match.index + match[0].length
    }

    if (lastIdx < text.length) {
      parts.push(renderFormatting(text.slice(lastIdx)))
    }

    return parts.length === 1 ? parts[0] : parts
  }

  const renderFormatting = (raw: string): React.ReactNode => {
    // Match bold **text**, code `code`, URLs https://...
    const tokens: React.ReactNode[] = []
    const regex = /(\*\*.*?\*\*|`.*?`|https?:\/\/[^\s<]+)/g
    let prev = 0
    let m: RegExpExecArray | null

    while ((m = regex.exec(raw)) !== null) {
      if (m.index > prev) {
        tokens.push(raw.slice(prev, m.index))
      }
      const token = m[0]
      if (token.startsWith('**') && token.endsWith('**')) {
        tokens.push(<strong key={m.index} className="font-bold text-stone-950 dark:text-white">{token.slice(2, -2)}</strong>)
      } else if (token.startsWith('`') && token.endsWith('`')) {
        tokens.push(
          <code key={m.index} className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-mono font-semibold text-indigo-700 dark:bg-stone-800 dark:text-indigo-300">
            {token.slice(1, -1)}
          </code>
        )
      } else if (token.startsWith('http')) {
        tokens.push(
          <a
            key={m.index}
            href={token}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-indigo-600 hover:underline dark:text-indigo-400"
          >
            <span>連結</span>
            <ExternalLink size={11} />
          </a>
        )
      }
      prev = m.index + token.length
    }

    if (prev < raw.length) {
      tokens.push(raw.slice(prev))
    }

    return tokens.length === 1 ? tokens[0] : <>{tokens}</>
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Table line
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.trim().slice(1, -1).split('|')
      // Check if it's separator row like |:---|:---|
      if (cells.every((c) => /^[\s:-]+$/.test(c))) {
        // Divider row, skip
        continue
      }
      if (!inTable) {
        inTable = true
        tableHeader = cells
      } else {
        tableRows.push(cells)
      }
      continue
    } else if (inTable) {
      flushTable(`line-${i}`)
    }

    // Horizontal rule
    if (/^---+$|^\*\*\*+$/.test(line.trim())) {
      elements.push(<hr key={i} className="my-3 border-stone-200 dark:border-white/10" />)
      continue
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="mt-3.5 mb-1.5 text-base font-bold text-stone-950 dark:text-white">
          {renderInline(line.slice(4))}
        </h3>
      )
      continue
    }
    if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={i} className="mt-2.5 mb-1 text-sm font-bold text-stone-900 dark:text-stone-100">
          {renderInline(line.slice(5))}
        </h4>
      )
      continue
    }
    if (line.startsWith('# ') || line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="mt-4 mb-2 text-lg font-extrabold text-stone-950 dark:text-white">
          {renderInline(line.replace(/^#+\s*/, ''))}
        </h2>
      )
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote
          key={i}
          className="my-2 border-l-4 border-indigo-500 bg-indigo-50/50 py-1.5 px-3 text-xs sm:text-sm text-stone-700 italic dark:bg-indigo-950/20 dark:text-stone-300"
        >
          {renderInline(line.slice(2))}
        </blockquote>
      )
      continue
    }

    // Bullet lists
    if (/^\s*[-*]\s+/.test(line)) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-sm leading-6 text-stone-800 dark:text-stone-200">
          {renderInline(line.replace(/^\s*[-*]\s+/, ''))}
        </li>
      )
      continue
    }

    // Numbered lists
    const numMatch = line.match(/^(\d+)\.\s+(.*)/)
    if (numMatch) {
      elements.push(
        <div key={i} className="ml-2 flex items-start gap-1.5 text-sm leading-6 text-stone-800 dark:text-stone-200">
          <span className="font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">{numMatch[1]}.</span>
          <span className="flex-1">{renderInline(numMatch[2])}</span>
        </div>
      )
      continue
    }

    // Empty lines
    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />)
      continue
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm leading-relaxed text-stone-800 dark:text-stone-200">
        {renderInline(line)}
      </p>
    )
  }

  if (inTable) {
    flushTable('end')
  }

  return <div className="space-y-1">{elements}</div>
}
