const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

/** Formats an amount in euros the Spanish way: 25,00 €. */
export function formatEUR(amount: number): string {
  return eur.format(amount)
}

/** Whole days left until `date`, never negative. */
export function daysUntil(date: Date, now: Date = new Date()): number {
  const startOfDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.max(0, Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000))
}

/** Parses "25", "25,5" or "25.50" into a number; empty means no limit (null). */
export function parseAmount(raw: string): number | null | undefined {
  const s = raw.trim().replace(/\s|€/g, '').replace(',', '.')
  if (!s) return null
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined
  return Number(s)
}

/** <input type="date"> value <-> timestamptz. Noon UTC keeps the same calendar day in Europe and the Americas. */
export function dateInputToIso(value: string): string | null {
  return value ? `${value}T12:00:00Z` : null
}

export function isoToDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

/** "Ana María López" -> "AL". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}
