import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'

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
