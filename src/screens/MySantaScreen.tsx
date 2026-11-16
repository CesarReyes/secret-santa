import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { EyeOff, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { Field } from '@/components/Field'
import { MemberAvatar } from '@/components/MemberAvatar'
import { PinInput } from '@/components/PinInput'
import { markViewed, useMyAssignment, useMyGifteeMailbox, type GiftStatus } from '@/lib/draw'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Chat } from '@/components/santa/Chat'
import { GiftStatusPicker } from '@/components/santa/GiftStatusPicker'
import { formatEUR } from '@/lib/format'
import { useCurrentGroup, type Group } from '@/lib/groups'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'

export function MySantaScreen() {
  const { group, isPending } = useCurrentGroup()
  const userId = useAuth((s) => s.session?.user.id) ?? ''
  if (isPending) return <div className="h-60 animate-pulse rounded-xl bg-muted" />
  if (!group) return <EmptyState emoji="🎄" title="Sin grupo">Cuando estés en un grupo, aquí verás a tu amigo secreto.</EmptyState>
  if (group.status === 'open') {
    return (
      <EmptyState emoji="🎅" title="Aún no hay sorteo">
        Cuando un admin haga el sorteo de {group.name}, aquí descubrirás a quién le regalas. Solo tú podrás verlo.
      </EmptyState>
    )
  }
  return <Assignment key={group.id} group={group} userId={userId} />
}

function Assignment({ group, userId }: { group: Group; userId: string }) {
  const { data, isPending, error, refetch } = useMyAssignment(group.id, userId, true)
  if (isPending) return <div className="h-60 animate-pulse rounded-xl bg-muted" />
  if (error) return <EmptyState emoji="⚠️" title="No pudimos cargar tu sorteo">Revisa tu conexión.</EmptyState>

  switch (data.state) {
    case 'none':
      return <EmptyState emoji="🎄" title="No estás en este sorteo">Entraste al grupo después del sorteo. Pide a un admin que lo repita.</EmptyState>
    case 'locked':
      return <Unlock onDone={() => refetch()} />
    case 'stale':
      return (
        <EmptyState emoji="🔑" title="Tu llave cambió">
          Tu sorteo se cifró con una llave que ya no tienes (por ejemplo, tras restablecer tu PIN). Pide a un admin que deshaga y repita el sorteo.
        </EmptyState>
      )
    case 'ready':
      return (
        <Tabs defaultValue="giving" className="gap-4">
          <TabsList className="grid h-11 w-full grid-cols-2">
            <TabsTrigger value="giving">Le regalo a…</TabsTrigger>
            <TabsTrigger value="receiving">Me regala… 🤫</TabsTrigger>
          </TabsList>
          <TabsContent value="giving">
            <Reveal
              group={group}
              userId={userId}
              receiverId={data.receiverId}
              firstTime={!data.viewedAt}
              giftStatus={data.giftStatus}
              mailbox={data.mailbox}
            />
          </TabsContent>
          <TabsContent value="receiving">
            <MySecretSanta group={group} userId={userId} />
          </TabsContent>
        </Tabs>
      )
  }
}

function Unlock({ onDone }: { onDone: () => void }) {
  const unlock = useAuth((s) => s.unlock)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await unlock(pin)
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <Lock className="size-8 text-primary" aria-hidden />
          <h2 className="text-xl font-semibold">Confirma tu PIN</h2>
          <p className="text-sm text-muted-foreground">Este teléfono aún no tiene tu llave. Con tu PIN la recuperamos para abrir tu sorteo.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field id="unlock-pin" label="PIN">
            <PinInput id="unlock-pin" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={busy || pin.length < 6}>
            {busy ? 'Abriendo…' : 'Abrir'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function useProfile(id: string) {
  return useQuery({
    queryKey: ['person', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('display_name, username').eq('id', id).single()
      if (error) throw error
      return data
    },
  })
}

type RevealProps = {
  group: Group
  userId: string
  receiverId: string
  firstTime: boolean
  giftStatus: GiftStatus
  mailbox: string | null
}

function Reveal({ group, userId, receiverId, firstTime, giftStatus, mailbox }: RevealProps) {
  const { data: person } = useProfile(receiverId)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (shown && firstTime) void markViewed(group.id, userId)
  }, [shown, firstTime, group.id, userId])

  const budget =
    group.budget_min != null && group.budget_max != null
      ? `entre ${formatEUR(group.budget_min)} y ${formatEUR(group.budget_max)}`
      : group.budget_max != null
        ? `hasta ${formatEUR(group.budget_max)}`
        : null

  if (!shown) {
    return (
      <div className="flex flex-col items-center gap-6 pt-6 text-center">
        <p className="text-muted-foreground">{firstTime ? '¡Ya hay sorteo en ' + group.name + '!' : group.name}</p>
        <button
          onClick={() => setShown(true)}
          className="gift-wiggle text-[8rem] leading-none drop-shadow-lg"
          aria-label="Abrir el regalo para ver a quién le regalas"
        >
          🎁
        </button>
        <p className="font-display text-2xl font-semibold">Toca para descubrir a quién le regalas</p>
        <p className="text-sm text-muted-foreground">Asegúrate de que nadie esté mirando tu pantalla.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="reveal-pop overflow-hidden border-gold/50 pt-0">
        <div className="bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground">Tu amigo secreto es</div>
        <CardContent className="flex flex-col items-center gap-3 pt-2 text-center">
          {person ? (
            <>
              <MemberAvatar name={person.display_name} seed={person.username} className="size-20 text-2xl" />
              <p className="font-display text-4xl font-semibold">{person.display_name}</p>
              <p className="text-sm text-muted-foreground">@{person.username}</p>
            </>
          ) : (
            <div className="h-36 w-full animate-pulse rounded-lg bg-muted" />
          )}
          {budget && <p className="text-sm">Regalo {budget}.</p>}
        </CardContent>
      </Card>
      <Button variant="ghost" className="w-full" onClick={() => setShown(false)}>
        <EyeOff /> Ocultar
      </Button>
      <GiftStatusPicker groupId={group.id} userId={userId} value={giftStatus} />
      {mailbox && person && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Pregúntale a {person.display_name}</h2>
          <Chat
            secret={mailbox}
            side="santa"
            otherName={person.display_name}
            intro={`${person.display_name} no sabrá que eres tú. Ni la base de datos guarda quién escribe.`}
            placeholder="¿Qué talla usas?"
          />
        </section>
      )}
      <p className="text-center text-sm text-muted-foreground">Su lista de deseos aparecerá aquí cuando la tengamos lista.</p>
    </div>
  )
}

function MySecretSanta({ group, userId }: { group: Group; userId: string }) {
  const { data: mailbox, isPending } = useMyGifteeMailbox(group.id, userId, true)
  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-muted" />
  if (!mailbox) {
    return (
      <EmptyState emoji="🤫" title="Chat no disponible">
        Este sorteo se hizo antes de que existiera el chat, o tu llave cambió. Un sorteo nuevo lo activa.
      </EmptyState>
    )
  }
  return (
    <Chat
      secret={mailbox}
      side="giftee"
      otherName="Tu amigo secreto"
      intro="Quien te regala puede escribirte aquí. Tú no sabes quién es, y nadie más puede leer esta conversación."
      placeholder="Una pista: me encantan los libros…"
    />
  )
}
