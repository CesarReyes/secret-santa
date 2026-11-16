import type { ReactNode } from 'react'

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
      <span className="text-4xl" aria-hidden>{emoji}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
