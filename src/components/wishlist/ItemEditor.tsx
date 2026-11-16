import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { LinkPreview } from '@shared/og'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/Field'
import { parseAmount } from '@/lib/format'
import {
  PRIORITY_LABEL,
  deletePhotos,
  fetchPreview,
  uploadPhoto,
  usePhotoUrls,
  useWishlistActions,
  type Priority,
  type WishItem,
} from '@/lib/wishlist'
import { cn } from '@/lib/utils'

type Props = {
  userId: string
  /** null = closed, 'new' = add, an item = edit */
  item: WishItem | 'new' | null
  onClose: () => void
}

const MAX_PHOTOS = 4

export function ItemEditor({ userId, item, onClose }: Props) {
  const editing = item && item !== 'new' ? item : null
  const { save, remove } = useWishlistActions(userId)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [price, setPrice] = useState('')
  const [priority, setPriority] = useState<Priority>(2)
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [preview, setPreview] = useState<LinkPreview | null>(null)
  const [previewFor, setPreviewFor] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Photos uploaded in this session but not saved yet; removed if the editor is dismissed.
  const fresh = useRef<string[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const { data: photoUrls = {} } = usePhotoUrls(photos)

  useEffect(() => {
    if (!item) return
    const it = item === 'new' ? null : item
    setTitle(it?.title ?? '')
    setUrl(it?.url ?? '')
    setPrice(it?.price != null ? String(it.price).replace('.', ',') : '')
    setPriority(it?.priority ?? 2)
    setNote(it?.note ?? '')
    setPhotos(it?.photos ?? [])
    setPreview(it?.preview ?? null)
    setPreviewFor(it?.url ?? '')
    fresh.current = []
  }, [item])

  const priceValue = parseAmount(price)
  const urlValue = url.trim() && !/^https?:\/\//i.test(url.trim()) ? `https://${url.trim()}` : url.trim()
  const urlError = urlValue && !isUrl(urlValue) ? 'Pega un enlace completo, por ejemplo https://…' : null

  async function loadPreview() {
    if (!urlValue || urlError || urlValue === previewFor) return
    setLoadingPreview(true)
    const p = await fetchPreview(urlValue)
    setLoadingPreview(false)
    setPreview(p)
    setPreviewFor(urlValue)
    if (p?.title && !title.trim()) setTitle(p.title.slice(0, 120))
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of [...files].slice(0, MAX_PHOTOS - photos.length)) {
        const path = await uploadPhoto(userId, file)
        fresh.current.push(path)
        setPhotos((p) => [...p, path])
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function dropPhoto(path: string) {
    setPhotos((p) => p.filter((x) => x !== path))
    if (fresh.current.includes(path)) {
      fresh.current = fresh.current.filter((x) => x !== path)
      void deletePhotos([path])
    }
  }

  function dismiss() {
    void deletePhotos(fresh.current)
    fresh.current = []
    onClose()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      if (urlValue && urlValue !== previewFor) await loadPreview()
      const removed = editing ? editing.photos.filter((p) => !photos.includes(p)) : []
      await save.mutateAsync({
        id: editing?.id,
        draft: {
          title: title.trim(),
          url: urlValue || null,
          price: priceValue ?? null,
          priority,
          note: note.trim() || null,
          photos,
          preview: urlValue ? (urlValue === previewFor ? preview : null) : null,
        },
      })
      await deletePhotos(removed)
      fresh.current = []
      toast.success(editing ? 'Guardado.' : 'Añadido a tu lista.')
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <>
      <Drawer open={Boolean(item)} onOpenChange={(o) => !o && dismiss()} repositionInputs={false}>
        <DrawerContent className="max-h-[92dvh]">
          <form noValidate onSubmit={submit} className="mx-auto w-full max-w-lg space-y-4 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <DrawerHeader className="px-0">
              <DrawerTitle className="font-display text-xl">{editing ? 'Editar deseo' : 'Nuevo deseo'}</DrawerTitle>
              <DrawerDescription>Todo tu grupo lo verá. Un enlace o una foto ayudan mucho.</DrawerDescription>
            </DrawerHeader>

            <Field id="w-url" label="Enlace (opcional)" hint={urlError ?? (loadingPreview ? 'Buscando vista previa…' : undefined)}>
              <Input
                id="w-url"
                type="url"
                inputMode="url"
                autoCapitalize="none"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={loadPreview}
                aria-invalid={Boolean(urlError)}
                className="h-11 text-base"
              />
            </Field>
            {preview && urlValue === previewFor && (preview.image || preview.title) && (
              <div className="flex gap-3 rounded-lg border bg-muted/40 p-2">
                {preview.image && <img src={preview.image} alt="" referrerPolicy="no-referrer" className="size-14 shrink-0 rounded object-cover" />}
                <div className="min-w-0 text-sm">
                  <p className="line-clamp-2 font-medium">{preview.title}</p>
                  <p className="text-muted-foreground">{preview.site}</p>
                </div>
              </div>
            )}

            <Field id="w-title" label="¿Qué te gustaría?">
              <Input id="w-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Una bufanda de lana" className="h-11 text-base" />
            </Field>

            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Cuánto lo quieres</legend>
                <div className="grid grid-cols-3 gap-1.5">
                  {([1, 2, 3] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={priority === p}
                      onClick={() => setPriority(p)}
                      className={cn(
                        'h-11 rounded-lg border px-1 text-xs leading-tight font-medium',
                        priority === p ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
                      )}
                    >
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <Field id="w-price" label="Precio (€)">
                <Input id="w-price" inputMode="decimal" placeholder="25" value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={priceValue === undefined} className="h-11 w-24 text-base" />
              </Field>
            </div>

            <Field id="w-note" label="Detalles (opcional)">
              <textarea
                id="w-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Talla M, color verde. Cualquier marca."
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </Field>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Fotos ({photos.length}/{MAX_PHOTOS})</legend>
              <div className="flex flex-wrap gap-2">
                {photos.map((p) => (
                  <div key={p} className="relative size-20 overflow-hidden rounded-lg bg-muted">
                    {photoUrls[p] && <img src={photoUrls[p]} alt="" className="size-full object-cover" />}
                    <button
                      type="button"
                      onClick={() => dropPhoto(p)}
                      className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
                      aria-label="Quitar foto"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                    className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground"
                  >
                    {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                    {uploading ? 'Subiendo' : 'Añadir'}
                  </button>
                )}
              </div>
              <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
            </fieldset>

            <Button
              type="submit"
              size="lg"
              className="h-11 w-full text-base"
              disabled={!title.trim() || Boolean(urlError) || priceValue === undefined || uploading || save.isPending}
            >
              {save.isPending ? 'Guardando…' : editing ? 'Guardar' : 'Añadir a mi lista'}
            </Button>
            {editing && (
              <Button type="button" variant="ghost" className="w-full text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Borrar
              </Button>
            )}
          </form>
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Borrar este deseo?"
        description="Se borra de tu lista junto con sus fotos."
        confirmLabel="Borrar"
        destructive
        onConfirm={async () => {
          if (!editing) return
          try {
            await remove.mutateAsync(editing)
            toast.success('Borrado.')
            onClose()
          } catch (err) {
            toast.error((err as Error).message)
          }
        }}
      />
    </>
  )
}

function isUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.')
  } catch {
    return false
  }
}
