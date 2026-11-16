import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MemberAvatar } from '@/components/MemberAvatar'
import { WishlistItems } from '@/components/wishlist/WishlistItems'
import { supabase } from '@/lib/supabase'

export function PersonWishlistScreen() {
  const { userId = '' } = useParams()
  const { data: person } = useQuery({
    queryKey: ['person', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('display_name, username').eq('id', userId).single()
      if (error) throw error
      return data
    },
  })

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/listas">
          <ChevronLeft /> Listas
        </Link>
      </Button>
      {person && (
        <div className="flex items-center gap-3">
          <MemberAvatar name={person.display_name} seed={person.username} className="size-12 text-base" />
          <h2 className="text-2xl font-semibold">Lista de {person.display_name}</h2>
        </div>
      )}
      <WishlistItems userId={userId} emptyTitle="Aún no hay deseos" emptyText="Todavía no ha añadido nada a su lista." />
    </div>
  )
}
