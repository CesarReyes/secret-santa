import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Field } from '@/components/Field'
import { useCreateGroup, type Group } from '@/lib/groups'
import { cn } from '@/lib/utils'
import { useCurrentGroupId } from '@/store/currentGroup'

/** Chips to switch between my groups, plus "new group". */
export function GroupSwitcher({ groups, current }: { groups: Group[]; current: Group | null }) {
  const select = useCurrentGroupId((s) => s.select)
  const [creating, setCreating] = useState(false)

  return (
    <>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {groups.map((g) => (
          <button
            key={g.id}
            onClick={() => select(g.id)}
            aria-pressed={g.id === current?.id}
            className={cn(
              'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
              g.id === current?.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
            )}
          >
            <span aria-hidden>{g.emoji}</span>
            {g.name}
          </button>
        ))}
        <button
          onClick={() => setCreating(true)}
          className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-dashed px-3 text-sm text-muted-foreground"
        >
          <Plus className="size-4" aria-hidden /> Nuevo grupo
        </button>
      </div>
      <CreateGroupDrawer open={creating} onOpenChange={setCreating} />
    </>
  )
}

function CreateGroupDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateGroup()
  const [name, setName] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await create.mutateAsync(name.trim())
      toast.success('Grupo creado.')
      setName('')
      onOpenChange(false)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent>
        <form onSubmit={submit} className="mx-auto w-full max-w-lg space-y-4 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <DrawerHeader className="px-0">
            <DrawerTitle className="font-display text-xl">Nuevo grupo</DrawerTitle>
            <DrawerDescription>Lo organizarás tú. Después añades a los participantes.</DrawerDescription>
          </DrawerHeader>
          <Field id="new-group" label="Nombre del grupo">
            <Input id="new-group" placeholder="Amigos de la uni" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-11 text-base" />
          </Field>
          <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={!name.trim() || create.isPending}>
            {create.isPending ? 'Creando…' : 'Crear grupo'}
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
