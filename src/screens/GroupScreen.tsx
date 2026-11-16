import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { GroupHeader } from '@/components/group/GroupHeader'
import { GroupSwitcher } from '@/components/group/GroupSwitcher'
import { MembersSection } from '@/components/group/MembersSection'
import { useCurrentGroup, useGroupActions, type Group } from '@/lib/groups'

export function GroupScreen() {
  const { groups, group, isPending, error } = useCurrentGroup()
  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-muted" />
  if (error) return <EmptyState emoji="⚠️" title="No pudimos cargar tus grupos">Revisa tu conexión.</EmptyState>

  return (
    <div className="space-y-5">
      <GroupSwitcher groups={groups} current={group} />
      {group ? (
        <>
          <GroupHeader group={group} />
          <MembersSection group={group} />
          {group.role === 'owner' && <DeleteGroup group={group} />}
        </>
      ) : (
        <EmptyState emoji="🎄" title="Aún no estás en ningún grupo">
          Pide a quien organiza que te sume, o crea tu propio grupo.
        </EmptyState>
      )}
    </div>
  )
}

function DeleteGroup({ group }: { group: Group }) {
  const { deleteGroup } = useGroupActions(group.id)
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <Button variant="ghost" className="w-full text-destructive" onClick={() => setConfirm(true)}>
        <Trash2 /> Eliminar grupo
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`¿Eliminar ${group.name}?`}
        description="Se borran el grupo, sus participantes y todo lo que contiene. Las cuentas de las personas siguen existiendo. No se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={async () => {
          try {
            await deleteGroup.mutateAsync()
            toast.success('Grupo eliminado.')
          } catch (err) {
            toast.error((err as Error).message)
          }
        }}
      />
    </>
  )
}
