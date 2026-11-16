import { CalendarDays, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/EmptyState'
import { daysUntil, formatEUR } from '@/lib/format'
import { useMyGroups, type Group } from '@/lib/groups'

const ROLE_LABEL = { owner: 'Organizas', admin: 'Admin', member: 'Participas' } as const

export function GroupScreen() {
  const { data: groups, isPending, error } = useMyGroups()
  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-muted" />
  if (error) return <EmptyState emoji="⚠️" title="No pudimos cargar tus grupos">Revisa tu conexión.</EmptyState>
  if (!groups.length) {
    return <EmptyState emoji="🎄" title="Aún no estás en ningún grupo">Pide a quien organiza que te sume.</EmptyState>
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <GroupCard key={g.id} group={g} />
      ))}
      <p className="text-center text-sm text-muted-foreground">La gestión de participantes llega en el siguiente paso.</p>
    </div>
  )
}

function GroupCard({ group }: { group: Group }) {
  const eventAt = group.event_at ? new Date(group.event_at) : null
  return (
    <Card className="border-gold/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-2xl">
          <span aria-hidden>{group.emoji}</span>
          <span className="min-w-0 flex-1 truncate">{group.name}</span>
          <Badge variant="outline" className="font-sans">{ROLE_LABEL[group.role]}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {eventAt && (
          <p className="font-display text-4xl font-semibold text-primary">
            {daysUntil(eventAt)} <span className="text-base font-normal text-muted-foreground">días para el intercambio</span>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <CalendarDays className="size-3.5" aria-hidden />
            {eventAt ? eventAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : 'Sin fecha'}
          </Badge>
          {(group.budget_min != null || group.budget_max != null) && (
            <Badge variant="outline" className="gap-1">
              <Wallet className="size-3.5" aria-hidden />
              {group.budget_min != null && formatEUR(group.budget_min)}
              {group.budget_min != null && group.budget_max != null && ' – '}
              {group.budget_max != null && formatEUR(group.budget_max)}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
