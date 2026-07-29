import { describe, expect, it } from 'vitest'
import { calculateImageDimensions, canOptimizePhoto } from './photoStorage'

describe('photo storage helpers', () => {
  it('scales the longest image edge to 1920 without enlarging small photos', () => {
    expect(calculateImageDimensions(4000, 3000)).toEqual({ width: 1920, height: 1440 })
    expect(calculateImageDimensions(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('optimizes supported photos but preserves animated and vector images', () => {
    expect(canOptimizePhoto(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }))).toBe(true)
    expect(canOptimizePhoto(new File(['x'], 'animation.gif', { type: 'image/gif' }))).toBe(false)
    expect(canOptimizePhoto(new File(['x'], 'drawing.svg', { type: 'image/svg+xml' }))).toBe(false)
    expect(canOptimizePhoto(new File(['x'], 'document.pdf', { type: 'application/pdf' }))).toBe(false)
  })
})
