import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export const REACTIONS = ['🎄', '❤️', '😂', '🎁', '👏'] as const
export type Reaction = (typeof REACTIONS)[number]

export const MAX_POST = 500

export type Post = {
  id: string
  author_id: string
  body: string
  created_at: string
  author: { display_name: string; username: string } | null
  reactions: { user_id: string; emoji: Reaction }[]
}

export function usePosts(groupId: string | undefined) {
  return useQuery({
    queryKey: ['posts', groupId],
    enabled: Boolean(groupId),
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await supabase
        .from('posts')
        .select('id, author_id, body, created_at, author:profiles!posts_author_id_fkey(display_name, username), reactions:post_reactions(user_id, emoji)')
        .eq('group_id', groupId!)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data as unknown as Post[]
    },
  })
}

/** Live updates: any change to this group's posts or reactions refreshes the wall. */
export function useWallRealtime(groupId: string | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!groupId) return
    const refresh = () => qc.invalidateQueries({ queryKey: ['posts', groupId] })
    const channel = supabase
      .channel(`wall:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `group_id=eq.${groupId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions', filter: `group_id=eq.${groupId}` }, refresh)
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [groupId, qc])
}

export function useWallActions(groupId: string, userId: string) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['posts', groupId] })
  return {
    post: useMutation({
      mutationFn: async (body: string) => {
        const { error } = await supabase.from('posts').insert({ group_id: groupId, body: body.trim().slice(0, MAX_POST) })
        if (error) throw new Error('No se pudo publicar.')
      },
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: async (postId: string) => {
        const { error } = await supabase.from('posts').delete().eq('id', postId)
        if (error) throw new Error('No se pudo borrar.')
      },
      onSuccess: refresh,
    }),
    toggleReaction: useMutation({
      mutationFn: async ({ post, emoji }: { post: Post; emoji: Reaction }) => {
        const mine = post.reactions.some((r) => r.user_id === userId && r.emoji === emoji)
        const { error } = mine
          ? await supabase.from('post_reactions').delete().match({ post_id: post.id, user_id: userId, emoji })
          : await supabase.from('post_reactions').insert({ post_id: post.id, emoji, group_id: groupId })
        if (error) throw new Error('No se pudo reaccionar.')
      },
      // Optimistic: flip the reaction right away, roll back on error.
      onMutate: async ({ post, emoji }) => {
        await qc.cancelQueries({ queryKey: ['posts', groupId] })
        const prev = qc.getQueryData<Post[]>(['posts', groupId])
        qc.setQueryData<Post[]>(['posts', groupId], (posts) =>
          posts?.map((p) => {
            if (p.id !== post.id) return p
            const mine = p.reactions.some((r) => r.user_id === userId && r.emoji === emoji)
            return {
              ...p,
              reactions: mine
                ? p.reactions.filter((r) => !(r.user_id === userId && r.emoji === emoji))
                : [...p.reactions, { user_id: userId, emoji }],
            }
          }),
        )
        return { prev }
      },
      onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['posts', groupId], ctx.prev),
      onSettled: refresh,
    }),
  }
}
