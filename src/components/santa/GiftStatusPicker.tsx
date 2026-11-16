import { Check, Gift, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { useSetGiftStatus, type GiftStatus } from '@/lib/draw'
import { cn } from '@/lib/utils'

const OPTIONS: { value: GiftStatus; label: string; icon: typeof Gift }[] = [
  { value: 'pending', label: 'Pendiente', icon: Gift },
  { value: 'bought', label: 'Comprado', icon: ShoppingBag },
  { value: 'delivered', label: 'Entregado', icon: Check },
]

/** Only I see which status is mine; the group only sees totals. */
export function GiftStatusPicker({ groupId, userId, value }: { groupId: string; userId: string; value: GiftStatus }) {
  const set = useSetGiftStatus(groupId, userId)
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Tu regalo</legend>
      <div className="grid grid-cols-3 gap-2" role="radiogroup">
        {OPTIONS.map(({ value: v, label, icon: Icon }) => (
          <button
            key={v}
            role="radio"
            aria-checked={value === v}
            disabled={set.isPending}
            onClick={() => v !== value && set.mutate(v, { onError: (e) => toast.error(e.message) })}
            className={cn(
              'flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium transition-colors',
              value === v ? 'border-secondary bg-secondary text-secondary-foreground' : 'bg-card hover:bg-muted',
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
