// Account rules shared by the browser app and the `accounts` Edge Function.
// Keep this file dependency-free: it is imported by Vite (src/) and by Deno.

/** Supabase Auth needs an email; users never see this one. `.invalid` is reserved and never routes mail. */
export const SYNTHETIC_EMAIL_DOMAIN = 'usuarios.amigo-secreto.invalid'

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,23}$/

/** Lowercases, trims and strips accents so "Lucía " and "lucia" are the same user. */
export function normalizeUsername(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
}

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username)
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${SYNTHETIC_EMAIL_DOMAIN}`
}

/** A PIN is 6+ digits; anything else is a password and needs 8+ characters. Returns an error message or null. */
export function validateNewPin(pin: string): string | null {
  if (/^\d+$/.test(pin)) {
    if (pin.length < 6) return 'El PIN debe tener al menos 6 dígitos.'
    if (/^(\d)\1+$/.test(pin)) return 'El PIN no puede ser un solo número repetido.'
    if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'El PIN no puede ser una secuencia.'
    return null
  }
  if (pin.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (pin.length > 72) return 'La contraseña es demasiado larga.'
  return null
}

/** Uniformly random 6-digit temporary PIN (rejection sampling, no modulo bias). */
export function generateTempPin(
  random: (buf: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer> = (b) => crypto.getRandomValues(b),
): string {
  const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000
  const buf = new Uint32Array(1)
  for (;;) {
    const n = random(buf)[0]
    if (n < limit) return String(n % 1_000_000).padStart(6, '0')
  }
}
