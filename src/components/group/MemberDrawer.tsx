import { useEffect, useState, type FormEvent } from 'react'
import { KeyRound, LogOut, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/Field'
import { MemberAvatar } from '@/components/MemberAvatar'
import { RANK, useGroupActions, type Group, type Member } from '@/lib/groups'
import type { Access } from './AccessCard'

type Props = {
  group: Group
  member: Member | null
  myId: string
  onClose: () => void
  onAccess: (access: Access) => void
}

type Pending = 'reset' | 'remove' | 'leave' | null

/** Actions on one participant. What shows depends on my rank versus theirs. */
export function MemberDrawer({ group, member, myId, onClose, onAccess }: Props) {
  const actions = useGroupActions(group.id)
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState<Pending>(null)

  useEffect(() => setName(member?.display_name ?? ''), [member])

  if (!member) return <Drawer open={false} />

  const isMe = member.user_id === myId
  const outranks = RANK[group.role] > RANK[member.role]
  const isOwner = group.role === 'owner'
  const open = group.status === 'open'
  const canRename = isMe || outranks
  const canReset = !isMe && outranks
  const canRemove = !isMe && outranks && open && member.role !== 'owner'
  const canToggleAdmin = isOwner && !isMe

  async function run(label: string, fn: () => Promise<unknown>, close = true) {
    try {
      await fn()
      toast.success(label)
      if (close) onClose()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function rename(e: FormEvent) {
    e.preventDefault()
    await run('Nombre actualizado.', () => actions.rename.mutateAsync({ userId: member!.user_id, name: name.trim() }), false)
  }

  async function resetPin() {
    try {
      const res = await actions.resetPin.mutateAsync(member!.user_id)
      onClose()
      onAccess({ name: member!.display_name, username: member!.username, pin: res.temp_pin, groupName: group.name })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <>
      <Drawer open onOpenChange={(o) => !o && onClose()} repositionInputs={false}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-lg space-y-4 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <DrawerHeader className="flex-row items-center gap-3 px-0 text-left">
              <MemberAvatar name={member.display_name} seed={member.username} className="size-12 text-base" />
              <div className="min-w-0">
                <DrawerTitle className="truncate font-display text-xl">{member.display_name}</DrawerTitle>
                <DrawerDescription>@{member.username}</DrawerDescription>
              </div>
            </DrawerHeader>

            {canRename && (
              <form onSubmit={rename} className="flex items-end gap-2">
                <div className="flex-1">
                  <Field id="rename" label="Nombre visible">
                    <Input id="rename" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-11 text-base" />
                  </Field>
                </div>
                <Button type="submit" variant="outline" className="h-11" disabled={!name.trim() || name.trim() === member.display_name || actions.rename.isPending}>
                  Guardar
                </Button>
              </form>
            )}

            {(canReset || canToggleAdmin || canRemove || (isMe && member.role !== 'owner')) && <Separator />}

            <div className="grid gap-2">
              {canReset && (
                <Button variant="outline" className="h-11 justify-start" onClick={() => setConfirm('reset')}>
                  <KeyRound /> Restablecer PIN
                </Button>
              )}
              {canToggleAdmin &&
                (member.role === 'admin' ? (
                  <Button variant="outline" className="h-11 justify-start" onClick={() => run('Ya no es admin.', () => actions.setRole.mutateAsync({ userId: member.user_id, role: 'member' }))}>
                    <ShieldOff /> Quitar admin
                  </Button>
                ) : (
                  <Button variant="outline" className="h-11 justify-start" onClick={() => run('Ahora es admin.', () => actions.setRole.mutateAsync({ userId: member.user_id, role: 'admin' }))}>
                    <ShieldCheck /> Hacer admin
                  </Button>
                ))}
              {canRemove && (
                <Button variant="outline" className="h-11 justify-start text-destructive" onClick={() => setConfirm('remove')}>
                  <Trash2 /> Quitar del grupo
                </Button>
              )}
              {isMe && member.role !== 'owner' && open && (
                <Button variant="outline" className="h-11 justify-start text-destructive" onClick={() => setConfirm('leave')}>
                  <LogOut /> Salir del grupo
                </Button>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={confirm === 'reset'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Restablecer el PIN de ${member.display_name}?`}
        description="Su PIN actual dejará de funcionar y tendrá que elegir uno nuevo al entrar. Si ya hubo sorteo y no tiene la app abierta en otro teléfono, habrá que repetirlo."
        confirmLabel="Restablecer"
        onConfirm={resetPin}
      />
      <ConfirmDialog
        open={confirm === 'remove'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Quitar a ${member.display_name}?`}
        description="Dejará de ver el grupo. Su cuenta sigue existiendo y se puede volver a añadir."
        confirmLabel="Quitar"
        destructive
        onConfirm={() => run('Quitado del grupo.', () => actions.remove.mutateAsync(member.user_id))}
      />
      <ConfirmDialog
        open={confirm === 'leave'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`¿Salir de ${group.name}?`}
        description="Dejarás de ver el grupo. Un admin puede volver a añadirte."
        confirmLabel="Salir"
        destructive
        onConfirm={() => run('Saliste del grupo.', () => actions.remove.mutateAsync(member.user_id))}
      />
    </>
  )
}
