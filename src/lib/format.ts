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
