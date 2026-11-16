import { describe, expect, it } from 'vitest'
import { daysUntil, formatEUR } from './format'

describe('formatEUR', () => {
  it('uses Spanish formatting', () => {
    expect(formatEUR(25).replace(/\s/g, ' ')).toBe('25,00 €')
    expect(formatEUR(1234.5).replace(/\s/g, ' ')).toBe('1234,50 €')
  })
})

describe('daysUntil', () => {
  it('counts calendar days and never goes negative', () => {
    const now = new Date(2026, 11, 20, 23, 0)
    expect(daysUntil(new Date(2026, 11, 24, 1, 0), now)).toBe(4)
    expect(daysUntil(new Date(2026, 11, 20, 8, 0), now)).toBe(0)
    expect(daysUntil(new Date(2026, 11, 1), now)).toBe(0)
  })
})
