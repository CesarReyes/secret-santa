import { useState, type FormEvent } from 'react'
import { SendHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { MemberAvatar } from '@/components/MemberAvatar'
import { RANK, useCurrentGroup, type Group } from '@/lib/groups'
import { MAX_POST, REACTIONS, usePosts, useWallActions, useWallRealtime, type Post } from '@/lib/wall'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/auth'

export function WallScreen() {
  const { group, isPending } = useCurrentGroup()
  const userId = useAuth((s) => s.session?.user.id) ?? ''
  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-muted" />
  if (!group) return <EmptyState emoji="💬" title="Muro del grupo">Cuando estés en un grupo, aquí verás sus mensajes.</EmptyState>
  return <Wall key={group.id} group={group} userId={userId} />
}

function Wall({ group, userId }: { group: Group; userId: string }) {
  const { data: posts, isPending, error } = usePosts(group.id)
  useWallRealtime(group.id)
  const actions = useWallActions(group.id, userId)
  const [text, setText] = useState('')
  const [deleting, setDeleting] = useState<Post | null>(null)
  const isAdmin = RANK[group.role] >= RANK.admin

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      await actions.post.mutateAsync(text)
      setText('')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">
        Muro de {group.emoji} {group.name}
      </h2>
      <form onSubmit={submit} className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_POST}
          rows={2}
          placeholder="Escribe algo al grupo: ¿quién trae el turrón?"
          aria-label="Mensaje al grupo"
          className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{text.length > MAX_POST - 80 ? `${MAX_POST - text.length} caracteres` : ''}</span>
          <Button type="submit" disabled={!text.trim() || actions.post.isPending}>
            <SendHorizontal /> Publicar
          </Button>
        </div>
      </form>

      {error ? (
        <EmptyState emoji="⚠️" title="No pudimos cargar el muro">Revisa tu conexión.</EmptyState>
      ) : isPending ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : !posts?.length ? (
        <EmptyState emoji="💬" title="Aún no hay mensajes">Sé el primero en saludar al grupo.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard
                post={post}
                userId={userId}
                canDelete={post.author_id === userId || isAdmin}
                onDelete={() => setDeleting(post)}
                onReact={(emoji) => actions.toggleReaction.mutate({ post, emoji })}
              />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="¿Borrar este mensaje?"
        description={deleting && deleting.author_id !== userId ? 'Lo borras como admin; desaparece para todo el grupo.' : 'Desaparece para todo el grupo.'}
        confirmLabel="Borrar"
        destructive
        onConfirm={async () => {
          if (!deleting) return
          try {
            await actions.remove.mutateAsync(deleting.id)
          } catch (err) {
            toast.error((err as Error).message)
          }
        }}
      />
    </div>
  )
}

const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
function when(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return relative.format(-mins, 'minute')
  if (mins < 24 * 60) return relative.format(-Math.round(mins / 60), 'hour')
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

type PostCardProps = {
  post: Post
  userId: string
  canDelete: boolean
  onDelete: () => void
  onReact: (emoji: (typeof REACTIONS)[number]) => void
}

function PostCard({ post, userId, canDelete, onDelete, onReact }: PostCardProps) {
  const name = post.author?.display_name ?? 'Alguien'
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center gap-3">
        <MemberAvatar name={name} seed={post.author?.username ?? post.author_id} className="size-9 text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {name}
            {post.author_id === userId && <span className="font-normal text-muted-foreground"> (tú)</span>}
          </p>
          <p className="text-xs text-muted-foreground">{when(post.created_at)}</p>
        </div>
        {canDelete && (
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={onDelete} aria-label="Borrar mensaje">
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <p className="text-[15px] whitespace-pre-wrap break-words">{post.body}</p>
      <div className="flex flex-wrap gap-1.5">
        {REACTIONS.map((emoji) => {
          const count = post.reactions.filter((r) => r.emoji === emoji).length
          const mine = post.reactions.some((r) => r.emoji === emoji && r.user_id === userId)
          return (
            <button
              key={emoji}
              onClick={() => onReact(emoji)}
              aria-pressed={mine}
              aria-label={`${emoji} ${count}`}
              className={cn(
                'flex h-8 items-center gap-1 rounded-full border px-2.5 text-sm transition-colors',
                mine ? 'border-primary bg-primary/10 font-medium' : count ? 'bg-card' : 'border-dashed bg-transparent opacity-60',
              )}
            >
              <span aria-hidden>{emoji}</span>
              {count > 0 && <span>{count}</span>}
            </button>
          )
        })}
      </div>
    </Card>
  )
}
