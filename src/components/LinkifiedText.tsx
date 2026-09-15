import { linkifyText } from '../utils/linkifyText'

interface LinkifiedTextProps {
  text: string
}

export function LinkifiedText({ text }: LinkifiedTextProps) {
  const segments = text.split(/(\*\*[^*\n]+\*\*)/gu).filter(Boolean)

  return <>{segments.map((segment, segmentIndex) => {
    const isBold = segment.startsWith('**') && segment.endsWith('**')
    const content = isBold ? segment.slice(2, -2) : segment
    const rendered = linkifyText(content).map((part, partIndex) => part.type === 'link' ? (
      <a
        className="break-all font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-indigo-300 dark:hover:text-indigo-200"
        href={part.href}
        key={`${part.value}-${segmentIndex}-${partIndex}`}
        rel="noopener noreferrer"
        target="_blank"
      >
        {part.value}
      </a>
    ) : <span key={`${part.value}-${segmentIndex}-${partIndex}`}>{part.value}</span>)

    return isBold
      ? <strong key={`${segment}-${segmentIndex}`}>{rendered}</strong>
      : <span key={`${segment}-${segmentIndex}`}>{rendered}</span>
  })}</>
}
