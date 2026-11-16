import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'

export type Profile = { id: string; username: string; display_name: string }

export function useMyProfile() {
  const userId = useAuth((s) => s.session?.user.id)
  return useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .eq('id', userId!)
        .single()
      if (error) throw error
      return data
    },
  })
}
