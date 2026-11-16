import { describe, expect, it } from 'vitest'
import {
  generateTempPin,
  isValidUsername,
  normalizeUsername,
  usernameToEmail,
  validateNewPin,
} from '@shared/account-rules'

describe('usernames', () => {
  it('normalizes case, accents and spaces', () => {
    expect(normalizeUsername('  Lucía ')).toBe('lucia')
    expect(normalizeUsername('Tío Pepe')).toBe('tio.pepe')
    expect(normalizeUsername('NÚÑEZ')).toBe('nunez')
  })

  it('accepts 3–24 safe characters only', () => {
    expect(isValidUsername('ana')).toBe(true)
    expect(isValidUsername('tio.pepe_2')).toBe(true)
    expect(isValidUsername('al')).toBe(false)
    expect(isValidUsername('.ana')).toBe(false)
    expect(isValidUsername('ana@x')).toBe(false)
    expect(isValidUsername('a'.repeat(25))).toBe(false)
  })

  it('maps to a synthetic, non-routable email', () => {
    expect(usernameToEmail('Lucía')).toBe('lucia@usuarios.amigo-secreto.invalid')
  })
})

describe('validateNewPin', () => {
  it('accepts 6+ digit PINs that are not trivial', () => {
    expect(validateNewPin('482915')).toBeNull()
    expect(validateNewPin('48291573')).toBeNull()
  })

  it('rejects short, repeated or sequential PINs', () => {
    expect(validateNewPin('12345')).toMatch(/6 dígitos/)
    expect(validateNewPin('111111')).toMatch(/repetido/)
    expect(validateNewPin('123456')).toMatch(/secuencia/)
    expect(validateNewPin('987654')).toMatch(/secuencia/)
  })

  it('treats anything non-numeric as a password of 8+ characters', () => {
    expect(validateNewPin('turrón')).toMatch(/8 caracteres/)
    expect(validateNewPin('turrón-2026')).toBeNull()
  })
})

describe('generateTempPin', () => {
  it('always returns 6 digits', () => {
    for (let i = 0; i < 200; i++) expect(generateTempPin()).toMatch(/^\d{6}$/)
  })

  it('pads small numbers and rejects values that would bias the result', () => {
    const values = [0xffff_ffff, 42]
    const fake = (b: Uint32Array<ArrayBuffer>) => ((b[0] = values.shift()!), b)
    expect(generateTempPin(fake)).toBe('000042')
  })
})
