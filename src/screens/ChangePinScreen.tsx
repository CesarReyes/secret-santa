import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { validateNewPin } from '@shared/account-rules'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/components/AuthLayout'
import { Field } from '@/components/Field'
import { PinInput } from '@/components/PinInput'
import { mustChangePin, useAuth } from '@/store/auth'

export function ChangePinScreen() {
  const navigate = useNavigate()
  const forced = useAuth((s) => mustChangePin(s.session))
  const changePin = useAuth((s) => s.changePin)
  const signOut = useAuth((s) => s.signOut)
  const [pin, setPin] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)

  const pinError = pin ? validateNewPin(pin) : null
  const repeatError = repeat && repeat !== pin ? 'No coincide.' : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await changePin(pin)
      toast.success('Listo, guardado.')
      navigate('/', { replace: true })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={forced ? 'Elige tu PIN o contraseña' : 'Cambiar PIN o contraseña'}
      description={forced ? 'Entraste con un PIN temporal. Elige un PIN o una contraseña que solo tú sepas.' : 'Puede ser un PIN numérico o una contraseña con letras.'}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field id="pin" label="Nuevo PIN o contraseña" hint={pinError ?? 'PIN de 6 dígitos o más, o contraseña de 8 caracteres o más. Toca ABC para escribir letras.'}>
          <PinInput id="pin" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value)} aria-invalid={Boolean(pinError)} />
        </Field>
        <Field id="repeat" label="Repítelo" hint={repeatError}>
          <PinInput id="repeat" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} aria-invalid={Boolean(repeatError)} />
        </Field>
        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={busy || !pin || Boolean(pinError) || repeat !== pin}>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
        {forced ? (
          <Button type="button" variant="ghost" className="w-full" onClick={signOut}>
            Salir
          </Button>
        ) : (
          <Button type="button" variant="ghost" className="w-full" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
        )}
      </form>
    </AuthLayout>
  )
}
