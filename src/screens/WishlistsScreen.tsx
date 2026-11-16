import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MemberAvatar } from '@/components/MemberAvatar'
import { ItemEditor } from '@/components/wishlist/ItemEditor'
import { WishlistItems } from '@/components/wishlist/WishlistItems'
import { useCurrentGroup, useMembers } from '@/lib/groups'
import { useWishlistCounts, type WishItem } from '@/lib/wishlist'
import { useAuth } from '@/store/auth'

export function WishlistsScreen() {
  const userId = useAuth((s) => s.session?.user.id) ?? ''
  const [editing, setEditing] = useState<WishItem | 'new' | null>(null)

  return (
    <div className="space-y-6">
      <GroupLists userId={userId} />
      <section className="space-y-3" aria-labelledby="my-list">
        <div className="flex items-center justify-between">
          <h2 id="my-list" className="text-xl font-semibold">Mi lista</h2>
          <Button onClick={() => setEditing('new')} className="h-10">
            <Plus /> Añadir
          </Button>
        </div>
        <WishlistItems
          userId={userId}
          emptyTitle="Tu lista está vacía"
          emptyText="Cuenta qué te gustaría recibir: con enlaces, fotos y detalles. Todo tu grupo podrá verla."
          onEdit={setEditing}
        />
      </section>
      <ItemEditor userId={userId} item={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function GroupLists({ userId }: { userId: string }) {
  const { group } = useCurrentGroup()
  const { data: members = [] } = useMembers(group?.id)
  const others = members.filter((m) => m.user_id !== userId)
  const { data: counts } = useWishlistCounts(others.map((m) => m.user_id))
  if (!group || others.length === 0) return null

  return (
    <section className="space-y-3" aria-labelledby="group-lists">
      <h2 id="group-lists" className="text-xl font-semibold">
        Listas de {group.emoji} {group.name}
      </h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {others.map((m) => {
          const n = counts?.get(m.user_id) ?? 0
          return (
            <li key={m.user_id}>
              <Link to={`/listas/${m.user_id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-muted/50">
                <MemberAvatar name={m.display_name} seed={m.username} />
                <span className="min-w-0 flex-1 truncate font-medium">{m.display_name}</span>
                <span className="text-sm text-muted-foreground">{n === 0 ? 'Sin deseos' : n === 1 ? '1 deseo' : `${n} deseos`}</span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
