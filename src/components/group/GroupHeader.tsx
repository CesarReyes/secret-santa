import { useState } from 'react'
import { CalendarDays, MapPin, Pencil, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { daysUntil, formatEUR } from '@/lib/format'
import { RANK, type Group } from '@/lib/groups'
import { GroupSettingsDrawer } from './GroupSettingsDrawer'

function budgetLabel(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `${formatEUR(min)} – ${formatEUR(max)}`
  if (max != null) return `Hasta ${formatEUR(max)}`
  if (min != null) return `Desde ${formatEUR(min)}`
  return null
}

export function GroupHeader({ group }: { group: Group }) {
  const [editing, setEditing] = useState(false)
  const isAdmin = RANK[group.role] >= RANK.admin
  const eventAt = group.event_at ? new Date(group.event_at) : null
  const days = eventAt ? daysUntil(eventAt) : null
  const budget = budgetLabel(group.budget_min, group.budget_max)

  return (
    <Card className="gap-4 border-gold/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-2xl">
          <span aria-hidden>{group.emoji}</span>
          <span className="min-w-0 flex-1 truncate">{group.name}</span>
          {isAdmin && (
            <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Editar grupo">
              <Pencil className="size-5" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {days != null &&
          (days > 0 ? (
            <p className="font-display text-4xl font-semibold text-primary">
              {days}{' '}
              <span className="text-base font-normal text-muted-foreground">
                {days === 1 ? 'día para el intercambio' : 'días para el intercambio'}
              </span>
            </p>
          ) : (
            <p className="font-display text-2xl font-semibold text-primary">¡Hoy es el intercambio! 🎉</p>
          ))}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <CalendarDays className="size-3.5" aria-hidden />
            {eventAt ? eventAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : 'Sin fecha'}
          </Badge>
          {group.location && (
            <Badge variant="outline" className="gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {group.location}
            </Badge>
          )}
          {budget && (
            <Badge variant="outline" className="gap-1">
              <Wallet className="size-3.5" aria-hidden />
              {budget}
            </Badge>
          )}
        </div>
        {isAdmin && !eventAt && !budget && (
          <Button variant="outline" className="w-full" onClick={() => setEditing(true)}>
            Añade fecha y presupuesto
          </Button>
        )}
      </CardContent>
      {isAdmin && <GroupSettingsDrawer group={group} open={editing} onOpenChange={setEditing} />}
    </Card>
  )
}
