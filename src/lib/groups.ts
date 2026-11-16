import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { accounts } from '@/lib/accounts'
import { useAuth } from '@/store/auth'
import { useCurrentGroupId } from '@/store/currentGroup'

export type Role = 'owner' | 'admin' | 'member'

export type Group = {
  id: string
  name: string
  emoji: string
  event_at: string | null
  location: string | null
  currency: string
  budget_min: number | null
  budget_max: number | null
  status: 'open' | 'drawn' | 'done'
  role: Role
}

export type Member = {
  user_id: string
  role: Role
  username: string
  display_name: string
  pin_pending: boolean
}

export type GroupSettings = Pick<Group, 'name' | 'emoji' | 'event_at' | 'location' | 'budget_min' | 'budget_max'>

export const RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 }

/** Groups I belong to, with my role in each (RLS only returns my memberships' groups). */
export function useMyGroups() {
  const userId = useAuth((s) => s.session?.user.id)
  return useQuery({
    queryKey: ['groups', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Group[]> => {
      const { data, error } = await supabase
        .from('group_members')
        .select('role, groups(id, name, emoji, event_at, location, currency, budget_min, budget_max, status)')
        .eq('user_id', userId!)
        .order('joined_at')
      if (error) throw error
      return data.flatMap((row) => {
        const g = row.groups as unknown as Omit<Group, 'role'> | null
        return g ? [{ ...g, role: row.role as Role }] : []
      })
    },
  })
}

/** The selected group, falling back to the first one if the saved choice is gone. */
export function useCurrentGroup() {
  const query = useMyGroups()
  const selected = useCurrentGroupId((s) => s.groupId)
  const groups = query.data ?? []
  const group = groups.find((g) => g.id === selected) ?? groups[0] ?? null
  return { ...query, groups, group }
}

export function useMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ['members', groupId],
    enabled: Boolean(groupId),
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('group_members')
        .select('user_id, role, profiles(username, display_name, pin_pending)')
        .eq('group_id', groupId!)
      if (error) throw error
      const members = data.flatMap((row) => {
        const p = row.profiles as unknown as Omit<Member, 'user_id' | 'role'> | null
        return p ? [{ user_id: row.user_id, role: row.role as Role, ...p }] : []
      })
      return members.sort(
        (a, b) => RANK[b.role] - RANK[a.role] || a.display_name.localeCompare(b.display_name, 'es'),
      )
    },
  })
}

/** Turns Postgres/RPC errors into something a person can read. */
function friendly(error: { message?: string; code?: string }): Error {
  const m = error.message ?? ''
  if (m.includes('the draw already happened')) return new Error('El sorteo ya se hizo; no se puede cambiar el grupo.')
  if (m.includes('unknown username')) return new Error('No existe ese usuario.')
  if (m.includes('runs another group')) return new Error('Esa persona administra otro grupo; solo ella puede cambiar su nombre.')
  if (m.includes('budget_range')) return new Error('El mínimo no puede ser mayor que el máximo.')
  if (error.code === '42501') return new Error('No tienes permiso para hacer esto.')
  return new Error('Algo salió mal. Inténtalo de nuevo.')
}

async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw friendly(error)
  return data
}

/** All group mutations; each refreshes the groups and members it touched. */
export function useGroupActions(groupId: string | undefined) {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['groups'] })
    qc.invalidateQueries({ queryKey: ['members', groupId] })
    qc.invalidateQueries({ queryKey: ['profile'] })
  }
  const m = <A, R>(fn: (args: A) => Promise<R>) => useMutation({ mutationFn: fn, onSuccess: refresh })

  return {
    updateSettings: m(async (settings: GroupSettings) => {
      const { error } = await supabase.from('groups').update(settings).eq('id', groupId!)
      if (error) throw friendly(error)
    }),
    createMember: m((v: { username: string; display_name: string }) =>
      accounts('create_member', { group_id: groupId!, ...v }),
    ),
    addExisting: m((username: string) => rpc('add_member_by_username', { p_group: groupId, p_username: username })),
    resetPin: m((userId: string) => accounts('reset_pin', { group_id: groupId!, user_id: userId })),
    rename: m((v: { userId: string; name: string }) =>
      rpc('rename_member', { p_group: groupId, p_user: v.userId, p_name: v.name }),
    ),
    setRole: m((v: { userId: string; role: 'admin' | 'member' }) =>
      rpc('set_member_role', { p_group: groupId, p_user: v.userId, p_role: v.role }),
    ),
    remove: m((userId: string) => rpc('remove_member', { p_group: groupId, p_user: userId })),
    deleteGroup: m(() => rpc('delete_group', { p_group: groupId })),
  }
}

export function useCreateGroup() {
  const qc = useQueryClient()
  const select = useCurrentGroupId((s) => s.select)
  return useMutation({
    mutationFn: async (name: string) => (await rpc('create_group', { p_name: name })) as string,
    onSuccess: (id) => {
      select(id)
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}
