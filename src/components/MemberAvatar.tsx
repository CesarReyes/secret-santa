import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

const TONES = ['bg-primary text-primary-foreground', 'bg-secondary text-secondary-foreground', 'bg-accent text-accent-foreground']

/** Initials on a festive color picked from the username, so each person keeps theirs. */
export function MemberAvatar({ name, seed, className }: { name: string; seed: string; className?: string }) {
  const tone = TONES[[...seed].reduce((sum, c) => sum + c.charCodeAt(0), 0) % TONES.length]
  return (
    <span
      aria-hidden
      className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold', tone, className)}
    >
      {initials(name)}
    </span>
  )
}
