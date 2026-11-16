import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { isValidUsername, normalizeUsername } from '@shared/account-rules'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Field } from '@/components/Field'
import { useGroupActions, type Group } from '@/lib/groups'
import type { Access } from './AccessCard'

type Props = {
  group: Group
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: (access: Access) => void
}

export function AddMemberDrawer({ group, open, onOpenChange, onCreated }: Props) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <DrawerHeader className="px-0">
            <DrawerTitle className="font-display text-xl">Añadir participante</DrawerTitle>
            <DrawerDescription>Crea su acceso o suma a alguien que ya tiene usuario.</DrawerDescription>
          </DrawerHeader>
          <Tabs defaultValue="new">
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="new">Nuevo</TabsTrigger>
              <TabsTrigger value="existing">Ya tiene usuario</TabsTrigger>
            </TabsList>
            <TabsContent value="new">
              <NewMemberForm group={group} onDone={(a) => { onOpenChange(false); onCreated(a) }} />
            </TabsContent>
            <TabsContent value="existing">
              <ExistingMemberForm group={group} onDone={() => onOpenChange(false)} />
            </TabsContent>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function NewMemberForm({ group, onDone }: { group: Group; onDone: (a: Access) => void }) {
  const { createMember } = useGroupActions(group.id)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [touched, setTouched] = useState(false)

  // Suggest a username from the name until the admin edits it by hand.
  const suggested = normalizeUsername(name.trim().split(/\s+/)[0] ?? '')
  const value = touched ? username : suggested
  const normalized = normalizeUsername(value)
  const error = value && !isValidUsername(normalized) ? 'De 3 a 24 letras, números, puntos o guiones.' : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const res = await createMember.mutateAsync({ username: normalized, display_name: name.trim() })
      onDone({ name: name.trim(), username: res.username, pin: res.temp_pin, groupName: group.name })
      setName('')
      setUsername('')
      setTouched(false)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="m-name" label="Nombre">
        <Input id="m-name" placeholder="Abuela Carmen" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-11 text-base" />
      </Field>
      <Field id="m-user" label="Usuario" hint={error ?? 'Con él entrará a la app. Debe ser único.'}>
        <Input
          id="m-user"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => { setTouched(true); setUsername(e.target.value) }}
          aria-invalid={Boolean(error)}
          className="h-11 text-base"
        />
      </Field>
      <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={!name.trim() || !value || Boolean(error) || createMember.isPending}>
        {createMember.isPending ? 'Creando…' : 'Crear acceso'}
      </Button>
    </form>
  )
}

function ExistingMemberForm({ group, onDone }: { group: Group; onDone: () => void }) {
  const { addExisting } = useGroupActions(group.id)
  const [username, setUsername] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await addExisting.mutateAsync(normalizeUsername(username))
      toast.success('Añadido al grupo.')
      setUsername('')
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="m-existing" label="Su usuario" hint="Entrará con el mismo usuario y PIN que ya tiene.">
        <Input id="m-existing" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} className="h-11 text-base" />
      </Field>
      <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={!username.trim() || addExisting.isPending}>
        {addExisting.isPending ? 'Añadiendo…' : 'Añadir'}
      </Button>
    </form>
  )
}
