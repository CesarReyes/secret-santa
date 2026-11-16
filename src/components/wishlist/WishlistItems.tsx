import { EmptyState } from '@/components/EmptyState'
import { usePhotoUrls, useWishlist, type WishItem } from '@/lib/wishlist'
import { ItemCard } from './ItemCard'

type Props = {
  userId: string
  emptyTitle: string
  emptyText: string
  onEdit?: (item: WishItem) => void
}

export function WishlistItems({ userId, emptyTitle, emptyText, onEdit }: Props) {
  const { data: items, isPending, error } = useWishlist(userId)
  const { data: photoUrls = {} } = usePhotoUrls(items?.flatMap((i) => i.photos) ?? [])
  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-muted" />
  if (error) return <EmptyState emoji="⚠️" title="No pudimos cargar la lista">Revisa tu conexión.</EmptyState>
  if (!items.length) return <EmptyState emoji="📜" title={emptyTitle}>{emptyText}</EmptyState>
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} photoUrls={photoUrls} onEdit={onEdit ? () => onEdit(item) : undefined} />
      ))}
    </div>
  )
}
