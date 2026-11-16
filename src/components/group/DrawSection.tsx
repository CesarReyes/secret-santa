import { useState, type FormEvent } from 'react'
import { Dices, Lock, Plus, RotateCcw, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useDrawActions, useDrawProgress, useExclusions, useKeyHolders } from '@/lib/draw'
import { RANK, useMembers, type Group, type Member } from '@/lib/groups'

export function DrawSection({ group }: { group: Group }) {
  const { data: members = [] } = useMembers(group.id)
  const isAdmin = RANK[group.role] >= RANK.admin
  const drawn = group.status !== 'open'

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <Dices className="size-5 text-primary" aria-hidden /> Sorteo
          {drawn && <Badge className="ml-auto bg-secondary font-sans">Hecho</Badge>}
        </CardTitle>
        <CardDescription className="flex items-start gap-1.5">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Cada asignación se cifra para quien regala. Nadie más puede verla, ni los admins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {drawn ? <Drawn group={group} isAdmin={isAdmin} /> : <Pending group={group} members={members} isAdmin={isAdmin} />}
      </CardContent>
    </Card>
  )
}

function Pending({ group, members, isAdmin }: { group: Group; members: Member[]; isAdmin: boolean }) {
  const { data: holders } = useKeyHolders(group.id, members.map((m) => m.user_id))
  const actions = useDrawActions(group.id)
  const [confirm, setConfirm] = useState(false)
  const notReady = members.filter((m) => m.pin_pending || (holders && !holders.has(m.user_id)))
  const tooFew = members.length < 3
  const blocked = tooFew || notReady.length > 0

  async function run() {
    try {
      await actions.run.mutateAsync()
      toast.success('¡Sorteo hecho! Cada quien ya puede ver a quién le regala.')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <>
      <Exclusions group={group} members={members} isAdmin={isAdmin} />
      {tooFew ? (
        <p className="text-sm text-muted-foreground">Hacen falta al menos 3 participantes.</p>
      ) : notReady.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Falta que entren a la app: <span className="font-medium text-foreground">{notReady.map((m) => m.display_name).join(', ')}</span>.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Todos listos.</p>
      )}
      {isAdmin ? (
        <Button size="lg" className="h-12 w-full text-base" disabled={blocked || actions.run.isPending} onClick={() => setConfirm(true)}>
          <Sparkles /> {actions.run.isPending ? 'Sorteando…' : 'Hacer el sorteo'}
        </Button>
      ) : (
        <p className="text-center text-sm text-muted-foreground">Un admin hará el sorteo cuando todos estén listos.</p>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="¿Hacer el sorteo?"
        description={`Se sortea entre ${members.length} personas. Después ya no se puede añadir ni quitar a nadie sin deshacerlo.`}
        confirmLabel="Sortear"
        onConfirm={run}
      />
    </>
  )
}

function Exclusions({ group, members, isAdmin }: { group: Group; members: Member[]; isAdmin: boolean }) {
  const { data: exclusions = [] } = useExclusions(group.id)
  const { addExclusion, removeExclusion } = useDrawActions(group.id)
  const [x, setX] = useState('')
  const [y, setY] = useState('')
  const [adding, setAdding] = useState(false)
  const name = (id: string) => members.find((m) => m.user_id === id)?.display_name ?? '…'

  async function add(e: FormEvent) {
    e.preventDefault()
    try {
      await addExclusion.mutateAsync({ x, y })
      setX('')
      setY('')
      setAdding(false)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (!isAdmin && exclusions.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">No se regalan entre sí</p>
      {exclusions.length === 0 && <p className="text-sm text-muted-foreground">Por ejemplo, parejas. Opcional.</p>}
      <ul className="flex flex-wrap gap-2">
        {exclusions.map((e) => (
          <li key={`${e.a}-${e.b}`}>
            <Badge variant="outline" className="h-8 gap-1.5 pr-1 text-sm">
              {name(e.a)} <span aria-label="y">↔</span> {name(e.b)}
              {isAdmin && (
                <button
                  onClick={() => removeExclusion.mutate(e)}
                  className="flex size-6 items-center justify-center rounded-full hover:bg-muted"
                  aria-label={`Quitar ${name(e.a)} y ${name(e.b)}`}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </Badge>
          </li>
        ))}
      </ul>
      {isAdmin &&
        (adding ? (
          <form onSubmit={add} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <PersonSelect label="Persona" value={x} onChange={setX} members={members} exclude={y} />
            <PersonSelect label="No le regala a" value={y} onChange={setY} members={members} exclude={x} />
            <Button type="submit" className="h-11" disabled={!x || !y || addExclusion.isPending} aria-label="Añadir pareja">
              <Plus />
            </Button>
          </form>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)} disabled={members.length < 2}>
            <Plus /> Añadir pareja
          </Button>
        ))}
    </div>
  )
}

function PersonSelect(props: { label: string; value: string; onChange: (v: string) => void; members: Member[]; exclude: string }) {
  return (
    <select
      aria-label={props.label}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      className="h-11 min-w-0 rounded-md border border-input bg-card px-2 text-base"
    >
      <option value="">Elegir…</option>
      {props.members
        .filter((m) => m.user_id !== props.exclude)
        .map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.display_name}
          </option>
        ))}
    </select>
  )
}

function Drawn({ group, isAdmin }: { group: Group; isAdmin: boolean }) {
  const { data: progress } = useDrawProgress(group.id, true)
  const { undo } = useDrawActions(group.id)
  const [confirm, setConfirm] = useState(false)
  const when = group.drawn_at ? new Date(group.drawn_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : null

  return (
    <>
      <p className="text-sm">
        Sorteo hecho{when && ` el ${when}`}.{' '}
        {progress && (
          <span className="text-muted-foreground">
            {progress.viewed} de {progress.total} ya vieron a quién le regalan.
          </span>
        )}
      </p>
      {isAdmin && (
        <>
          <Button variant="outline" className="w-full text-destructive" onClick={() => setConfirm(true)}>
            <RotateCcw /> Deshacer sorteo
          </Button>
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title="¿Deshacer el sorteo?"
            description="Se borran todas las asignaciones y nadie podrá recuperarlas. Úsalo para cambiar participantes o si alguien perdió su acceso. Luego haz un sorteo nuevo y avisa a todos."
            confirmLabel="Deshacer"
            destructive
            onConfirm={async () => {
              try {
                await undo.mutateAsync()
                toast.success('Sorteo deshecho.')
              } catch (err) {
                toast.error((err as Error).message)
              }
            }}
          />
        </>
      )}
    </>
  )
}
