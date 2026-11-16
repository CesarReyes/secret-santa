import { CalendarDays, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { daysUntil, formatEUR } from '@/lib/format'

// Placeholder data until groups are wired to Supabase (step 3 of the plan).
const DEMO = { name: 'Familia', emoji: '🎄', eventAt: new Date(new Date().getFullYear(), 11, 24), min: 20, max: 40 }

export function GroupScreen() {
  const days = daysUntil(DEMO.eventAt)
  return (
    <div className="space-y-4">
      <Card className="border-gold/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-2xl">
            <span aria-hidden>{DEMO.emoji}</span> {DEMO.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-display text-4xl font-semibold text-primary">
            {days} <span className="text-base font-normal text-muted-foreground">días para el intercambio</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {DEMO.eventAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Wallet className="size-3.5" aria-hidden />
              {formatEUR(DEMO.min)} – {formatEUR(DEMO.max)}
            </Badge>
          </div>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">Vista previa. Los grupos reales llegan en el siguiente paso.</p>
    </div>
  )
}
