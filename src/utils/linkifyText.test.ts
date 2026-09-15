import { describe, expect, it } from 'vitest'
import { linkifyText } from './linkifyText'

describe('linkifyText', () => {
  it('recognizes http, https, and www links while preserving surrounding text', () => {
    expect(linkifyText('入口 https://example.com/a 與 www.example.org')).toEqual([
      { type: 'text', value: '入口 ' },
      { type: 'link', value: 'https://example.com/a', href: 'https://example.com/a' },
      { type: 'text', value: ' 與 ' },
      { type: 'link', value: 'www.example.org', href: 'https://www.example.org' },
    ])
  })

  it('keeps sentence punctuation outside a link', () => {
    expect(linkifyText('請看 https://example.com/path。')).toEqual([
      { type: 'text', value: '請看 ' },
      { type: 'link', value: 'https://example.com/path', href: 'https://example.com/path' },
      { type: 'text', value: '。' },
    ])
  })

  it('does not turn unsafe protocols into links', () => {
    expect(linkifyText('javascript:alert(1)')).toEqual([{ type: 'text', value: 'javascript:alert(1)' }])
  })
})
