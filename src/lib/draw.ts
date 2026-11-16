import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { open as openSealed } from '@shared/crypto'
import { invoke } from '@/lib/accounts'
import { myLocalKey } from '@/lib/keys'
import { supabase } from '@/lib/supabase'

export type Exclusion = { a: string; b: string }

export function useExclusions(groupId: string) {
  return useQuery({
    queryKey: ['exclusions', groupId],
    queryFn: async (): Promise<Exclusion[]> => {
      const { data, error } = await supabase.from('exclusions').select('a, b').eq('group_id', groupId)
      if (error) throw error
      return data
    },
  })
}

/** Who in the group already has a draw key (everyone needs one before the draw). */
export function useKeyHolders(groupId: string, userIds: string[]) {
  return useQuery({
    queryKey: ['key-holders', groupId, userIds.join(',')],
    enabled: userIds.length > 0,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('user_keys').select('user_id').in('user_id', userIds)
      if (error) throw error
      return new Set(data.map((r) => r.user_id as string))
    },
  })
}

export function useDrawProgress(groupId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['draw-progress', groupId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('draw_progress', { p_group: groupId }).single()
      if (error) throw error
      return data as { total: number; viewed: number }
    },
  })
}

export function useDrawActions(groupId: string) {
  const qc = useQueryClient()
  const refresh = () => {
    for (const key of [['groups'], ['exclusions', groupId], ['draw-progress', groupId], ['assignment', groupId]]) {
      qc.invalidateQueries({ queryKey: key })
    }
  }
  const sorted = (x: string, y: string) => (x < y ? { a: x, b: y } : { a: y, b: x })
  return {
    addExclusion: useMutation({
      mutationFn: async ({ x, y }: { x: string; y: string }) => {
        const { error } = await supabase.from('exclusions').insert({ group_id: groupId, ...sorted(x, y) })
        if (error) throw new Error(error.code === '23505' ? 'Esa pareja ya está.' : 'No se pudo guardar.')
      },
      onSuccess: refresh,
    }),
    removeExclusion: useMutation({
      mutationFn: async (e: Exclusion) => {
        const { error } = await supabase.from('exclusions').delete().match({ group_id: groupId, a: e.a, b: e.b })
        if (error) throw new Error('No se pudo quitar.')
      },
      onSuccess: refresh,
    }),
    run: useMutation({
      mutationFn: () => invoke<{ ok: true; participants: number }>('draw', { action: 'run', group_id: groupId }),
      onSuccess: refresh,
    }),
    undo: useMutation({
      mutationFn: async () => {
        const { error } = await supabase.rpc('undo_draw', { p_group: groupId })
        if (error) throw new Error('No se pudo deshacer el sorteo.')
      },
      onSuccess: refresh,
    }),
  }
}

export type MyAssignment =
  | { state: 'none' }
  | { state: 'locked' } // no key on this device: needs the PIN
  | { state: 'stale' } // sealed for a key I no longer have
  | { state: 'ready'; receiverId: string; viewedAt: string | null }

/** Fetches my sealed row and opens it on this device. The receiver never leaves the browser. */
export function useMyAssignment(groupId: string, userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['assignment', groupId, userId],
    enabled,
    staleTime: Infinity,
    queryFn: async (): Promise<MyAssignment> => {
      const { data, error } = await supabase
        .from('assignments')
        .select('ciphertext, key_id, viewed_at')
        .eq('group_id', groupId)
        .eq('giver_id', userId)
        .maybeSingle()
      if (error) throw error
      if (!data) return { state: 'none' }
      const key = await myLocalKey(userId)
      if (!key) return { state: 'locked' }
      if (key.keyId !== data.key_id) return { state: 'stale' }
      try {
        const plain = JSON.parse(await openSealed(key.privateKey, data.ciphertext, `${groupId}:${userId}`))
        return { state: 'ready', receiverId: plain.receiver, viewedAt: data.viewed_at }
      } catch {
        return { state: 'stale' }
      }
    },
  })
}

export async function markViewed(groupId: string, userId: string) {
  await supabase
    .from('assignments')
    .update({ viewed_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('giver_id', userId)
    .is('viewed_at', null)
}
