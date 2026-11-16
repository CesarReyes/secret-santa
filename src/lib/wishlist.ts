import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { LinkPreview } from '@shared/og'
import { invoke } from '@/lib/accounts'
import { supabase } from '@/lib/supabase'

export type Priority = 1 | 2 | 3

export type WishItem = {
  id: string
  user_id: string
  title: string
  note: string | null
  url: string | null
  price: number | null
  priority: Priority
  preview: LinkPreview | null
  photos: string[]
  created_at: string
}

export type WishDraft = Pick<WishItem, 'title' | 'note' | 'url' | 'price' | 'priority' | 'preview' | 'photos'>

export const PRIORITY_LABEL: Record<Priority, string> = { 1: 'Lo quiero mucho', 2: 'Me gustaría', 3: 'Un detalle' }

const BUCKET = 'wishlist'
const MAX_SIDE = 1280

export function useWishlist(userId: string | undefined) {
  return useQuery({
    queryKey: ['wishlist', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<WishItem[]> => {
      const { data, error } = await supabase
        .from('wishlist_items')
        .select('id, user_id, title, note, url, price, priority, preview, photos, created_at')
        .eq('user_id', userId!)
        .order('priority')
        .order('created_at')
      if (error) throw error
      return data as WishItem[]
    },
  })
}

/** Item counts for several people at once (for the group overview). */
export function useWishlistCounts(userIds: string[]) {
  return useQuery({
    queryKey: ['wishlist-counts', userIds.join(',')],
    enabled: userIds.length > 0,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.from('wishlist_items').select('user_id').in('user_id', userIds)
      if (error) throw error
      const counts = new Map<string, number>()
      for (const r of data) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1)
      return counts
    },
  })
}

/** Short-lived signed URLs for private photos. */
export function usePhotoUrls(paths: string[]) {
  return useQuery({
    queryKey: ['photo-urls', paths.join('|')],
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
      if (error) throw error
      return Object.fromEntries(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])))
    },
  })
}

/** Shrinks a photo to MAX_SIDE and re-encodes it as JPEG (also strips EXIF/location data). */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la foto.'))), 'image/jpeg', 0.82),
  )
}

export async function uploadPhoto(userId: string, file: File): Promise<string> {
  let blob: Blob
  try {
    blob = await shrink(file)
  } catch {
    throw new Error('No pudimos leer esa foto. Prueba con otra.')
  }
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw new Error('No se pudo subir la foto.')
  return path
}

export async function deletePhotos(paths: string[]) {
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
}

export async function fetchPreview(url: string): Promise<LinkPreview | null> {
  try {
    return (await invoke<{ preview: LinkPreview | null }>('link-preview', { url })).preview
  } catch {
    return null
  }
}

export function useWishlistActions(userId: string) {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['wishlist', userId] })
    qc.invalidateQueries({ queryKey: ['wishlist-counts'] })
  }
  return {
    save: useMutation({
      mutationFn: async ({ id, draft }: { id?: string; draft: WishDraft }) => {
        const query = id
          ? supabase.from('wishlist_items').update(draft).eq('id', id)
          : supabase.from('wishlist_items').insert({ ...draft, user_id: userId })
        const { error } = await query
        if (error) throw new Error('No se pudo guardar.')
      },
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: async (item: WishItem) => {
        const { error } = await supabase.from('wishlist_items').delete().eq('id', item.id)
        if (error) throw new Error('No se pudo borrar.')
        await deletePhotos(item.photos)
      },
      onSuccess: refresh,
    }),
  }
}
