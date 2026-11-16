import { describe, expect, it } from 'vitest'
import { dateInputToIso, daysUntil, formatEUR, initials, isoToDateInput, parseAmount } from './format'

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

describe('parseAmount', () => {
  it('accepts Spanish and English decimals, empty as no limit', () => {
    expect(parseAmount('25')).toBe(25)
    expect(parseAmount('25,5')).toBe(25.5)
    expect(parseAmount(' 30.00 € ')).toBe(30)
    expect(parseAmount('')).toBeNull()
  })

  it('rejects garbage and negatives', () => {
    expect(parseAmount('abc')).toBeUndefined()
    expect(parseAmount('-5')).toBeUndefined()
    expect(parseAmount('1,234')).toBeUndefined()
  })
})

describe('dates and initials', () => {
  it('round-trips date inputs', () => {
    expect(dateInputToIso('2026-12-24')).toBe('2026-12-24T12:00:00Z')
    expect(isoToDateInput('2026-12-24T12:00:00+00:00')).toBe('2026-12-24')
    expect(dateInputToIso('')).toBeNull()
  })

  it('takes first and last initials', () => {
    expect(initials('Ana María López')).toBe('AL')
    expect(initials('lucía')).toBe('L')
  })
})
