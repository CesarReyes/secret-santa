import { useState } from 'react'
import { ChevronRight, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MemberAvatar } from '@/components/MemberAvatar'
import { RANK, useMembers, type Group, type Member } from '@/lib/groups'
import { useAuth } from '@/store/auth'
import { AccessCard, type Access } from './AccessCard'
import { AddMemberDrawer } from './AddMemberDrawer'
import { MemberDrawer } from './MemberDrawer'

const ROLE_BADGE = { owner: 'Organiza', admin: 'Admin', member: null } as const

export function MembersSection({ group }: { group: Group }) {
  const myId = useAuth((s) => s.session?.user.id) ?? ''
  const { data: members, isPending } = useMembers(group.id)
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<Member | null>(null)
  const [access, setAccess] = useState<Access | null>(null)
  const isAdmin = RANK[group.role] >= RANK.admin
  const pending = members?.filter((m) => m.pin_pending).length ?? 0

  return (
    <section aria-labelledby="members-title" className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 id="members-title" className="text-xl font-semibold">
            Participantes {members && <span className="text-muted-foreground">({members.length})</span>}
          </h2>
          {isAdmin && pending > 0 && (
            <p className="text-sm text-muted-foreground">
              {pending === 1 ? '1 persona aún no ha entrado.' : `${pending} personas aún no han entrado.`}
            </p>
          )}
        </div>
        {isAdmin && group.status === 'open' && (
          <Button onClick={() => setAdding(true)} className="h-10">
            <UserPlus /> Añadir
          </Button>
        )}
      </div>

      {isPending ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {members?.map((m) => {
            const actionable = m.user_id === myId || RANK[group.role] > RANK[m.role]
            const content = (
              <>
                <MemberAvatar name={m.display_name} seed={m.username} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.display_name}
                    {m.user_id === myId && <span className="text-muted-foreground"> (tú)</span>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">@{m.username}</p>
                </div>
                {m.pin_pending && <Badge variant="outline" className="border-gold text-accent-foreground">Sin entrar</Badge>}
                {ROLE_BADGE[m.role] && <Badge variant="secondary">{ROLE_BADGE[m.role]}</Badge>}
              </>
            )
            return (
              <li key={m.user_id}>
                {actionable ? (
                  <button onClick={() => setSelected(m)} aria-label={`${m.display_name}: opciones`} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/50">
                    {content}
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-3">{content}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {isAdmin && members?.length === 1 && (
        <p className="text-center text-sm text-muted-foreground">Añade a la familia y amigos. A cada uno le darás su usuario y un PIN temporal.</p>
      )}

      <AddMemberDrawer group={group} open={adding} onOpenChange={setAdding} onCreated={setAccess} />
      {selected && (
        <MemberDrawer group={group} member={selected} myId={myId} onClose={() => setSelected(null)} onAccess={setAccess} />
      )}
      <AccessCard access={access} onClose={() => setAccess(null)} />
    </section>
  )
}
