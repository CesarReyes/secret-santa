import { useState } from 'react'
import { ExternalLink, Heart, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { formatEUR } from '@/lib/format'
import { PRIORITY_LABEL, type WishItem } from '@/lib/wishlist'
import { cn } from '@/lib/utils'

type Props = { item: WishItem; photoUrls: Record<string, string>; onEdit?: () => void }

export function ItemCard({ item, photoUrls, onEdit }: Props) {
  const [zoom, setZoom] = useState<string | null>(null)
  const photos = item.photos.map((p) => photoUrls[p]).filter(Boolean)
  const cover = photos[0] ?? item.preview?.image
  const site = item.preview?.site ?? (item.url ? safeHost(item.url) : null)

  return (
    <Card className="gap-0 overflow-hidden py-0">
      {cover && (
        <button
          className="block aspect-[16/10] w-full bg-muted"
          onClick={() => setZoom(cover)}
          aria-label={`Ver foto de ${item.title}`}
        >
          <img src={cover} alt="" referrerPolicy="no-referrer" loading="lazy" className="size-full object-cover" />
        </button>
      )}
      <div className="space-y-2 p-4">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 font-sans text-base font-semibold leading-snug">{item.title}</h3>
          {onEdit && (
            <Button variant="ghost" size="icon" className="-mt-1 -mr-2 size-9" onClick={onEdit} aria-label={`Editar ${item.title}`}>
              <Pencil className="size-4" />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={item.priority === 1 ? 'default' : 'outline'} className="gap-1">
            <Heart className={cn('size-3', item.priority === 1 && 'fill-current')} aria-hidden />
            {PRIORITY_LABEL[item.priority]}
          </Badge>
          {item.price != null && <span className="text-sm font-medium">≈ {formatEUR(item.price)}</span>}
        </div>
        {item.note && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{item.note}</p>}
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pt-1">
            {photos.slice(1).map((src) => (
              <button key={src} onClick={() => setZoom(src)} className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted" aria-label="Ver foto">
                <img src={src} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {item.url && (
          <Button asChild variant="outline" size="sm" className="w-full justify-between">
            <a href={item.url} target="_blank" rel="noopener noreferrer nofollow">
              <span className="truncate">{item.preview?.title && item.preview.title !== item.title ? item.preview.title : `Ver en ${site}`}</span>
              <ExternalLink className="shrink-0" />
            </a>
          </Button>
        )}
      </div>
      <Dialog open={Boolean(zoom)} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-lg p-2">
          <DialogTitle className="sr-only">{item.title}</DialogTitle>
          {zoom && <img src={zoom} alt={item.title} referrerPolicy="no-referrer" className="max-h-[80dvh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'la web'
  }
}
