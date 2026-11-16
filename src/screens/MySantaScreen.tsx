import { EmptyState } from '@/components/EmptyState'

export function MySantaScreen() {
  return (
    <EmptyState emoji="🎅" title="Aún no hay sorteo">
      Cuando un admin haga el sorteo, aquí descubrirás a quién le regalas. Solo tú podrás verlo.
    </EmptyState>
  )
}
