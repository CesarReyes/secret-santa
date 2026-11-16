import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Field } from '@/components/Field'
import { dateInputToIso, isoToDateInput, parseAmount } from '@/lib/format'
import { useGroupActions, type Group } from '@/lib/groups'
import { cn } from '@/lib/utils'

const EMOJIS = ['🎄', '🎁', '🎅', '⛄', '🦌', '🌟', '🔔', '🍪']

export function GroupSettingsDrawer({ group, open, onOpenChange }: { group: Group; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { updateSettings } = useGroupActions(group.id)
  const [name, setName] = useState(group.name)
  const [emoji, setEmoji] = useState(group.emoji)
  const [date, setDate] = useState(isoToDateInput(group.event_at))
  const [location, setLocation] = useState(group.location ?? '')
  const [min, setMin] = useState(group.budget_min?.toString().replace('.', ',') ?? '')
  const [max, setMax] = useState(group.budget_max?.toString().replace('.', ',') ?? '')

  // Reset the form to the saved values every time it opens.
  useEffect(() => {
    if (!open) return
    setName(group.name)
    setEmoji(group.emoji)
    setDate(isoToDateInput(group.event_at))
    setLocation(group.location ?? '')
    setMin(group.budget_min?.toString().replace('.', ',') ?? '')
    setMax(group.budget_max?.toString().replace('.', ',') ?? '')
  }, [open, group])

  const minValue = parseAmount(min)
  const maxValue = parseAmount(max)
  const amountError =
    minValue === undefined || maxValue === undefined
      ? 'Escribe solo números, por ejemplo 25 o 25,50.'
      : minValue != null && maxValue != null && minValue > maxValue
        ? 'El mínimo no puede ser mayor que el máximo.'
        : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await updateSettings.mutateAsync({
        name: name.trim(),
        emoji,
        event_at: dateInputToIso(date),
        location: location.trim() || null,
        budget_min: minValue ?? null,
        budget_max: maxValue ?? null,
      })
      toast.success('Grupo actualizado.')
      onOpenChange(false)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <DrawerHeader className="px-0">
            <DrawerTitle className="font-display text-xl">Editar grupo</DrawerTitle>
            <DrawerDescription>Fecha, lugar y presupuesto del intercambio.</DrawerDescription>
          </DrawerHeader>
          <form onSubmit={submit} className="space-y-4">
            <Field id="g-name" label="Nombre">
              <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-11 text-base" />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Emoji</legend>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    aria-pressed={emoji === e}
                    aria-label={`Emoji ${e}`}
                    className={cn(
                      'flex size-11 items-center justify-center rounded-lg border text-2xl transition-colors',
                      emoji === e ? 'border-primary bg-primary/10' : 'bg-card',
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field id="g-date" label="Fecha">
                <Input id="g-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 text-base" />
              </Field>
              <Field id="g-location" label="Lugar">
                <Input id="g-location" placeholder="Casa de la abuela" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} className="h-11 text-base" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field id="g-min" label="Mínimo (€)">
                <Input id="g-min" inputMode="decimal" placeholder="20" value={min} onChange={(e) => setMin(e.target.value)} aria-invalid={Boolean(amountError)} className="h-11 text-base" />
              </Field>
              <Field id="g-max" label="Máximo (€)">
                <Input id="g-max" inputMode="decimal" placeholder="40" value={max} onChange={(e) => setMax(e.target.value)} aria-invalid={Boolean(amountError)} className="h-11 text-base" />
              </Field>
            </div>
            {amountError && <p className="text-sm text-destructive">{amountError}</p>}
            <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={!name.trim() || Boolean(amountError) || updateSettings.isPending}>
              {updateSettings.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
