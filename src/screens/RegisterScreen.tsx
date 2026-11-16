import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { isValidUsername, normalizeUsername, validateNewPin } from '@shared/account-rules'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthLayout } from '@/components/AuthLayout'
import { Field } from '@/components/Field'
import { PinInput } from '@/components/PinInput'
import { accounts } from '@/lib/accounts'
import { useAuth } from '@/store/auth'

export function RegisterScreen() {
  const signIn = useAuth((s) => s.signIn)
  const [groupName, setGroupName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)

  const normalized = normalizeUsername(username)
  const usernameError = username && !isValidUsername(normalized) ? 'De 3 a 24 letras, números, puntos o guiones.' : null
  const pinError = pin ? validateNewPin(pin) : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await accounts('register', { username: normalized, display_name: displayName.trim(), pin, group_name: groupName.trim() })
      await signIn(normalized, pin)
      toast.success('¡Grupo creado! Ahora suma a los participantes.')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const ready = groupName.trim() && displayName.trim() && username && !usernameError && pin && !pinError

  return (
    <AuthLayout title="Crea tu grupo" description="Serás quien lo administra. Luego das de alta a los demás.">
      <form onSubmit={submit} className="space-y-4">
        <Field id="group" label="Nombre del grupo">
          <Input id="group" placeholder="Familia García" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="h-11 text-base" maxLength={60} />
        </Field>
        <Field id="name" label="Tu nombre">
          <Input id="name" autoComplete="name" placeholder="Lucía" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-11 text-base" maxLength={40} />
        </Field>
        <Field
          id="username"
          label="Tu usuario"
          hint={usernameError ?? (username && normalized !== username ? `Será: ${normalized}` : 'Con él entrarás a la app.')}
        >
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={Boolean(usernameError)}
            className="h-11 text-base"
          />
        </Field>
        <Field id="pin" label="Tu PIN" hint={pinError ?? '6 dígitos o más, o una contraseña de 8+ caracteres.'}>
          <PinInput id="pin" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value)} aria-invalid={Boolean(pinError)} />
        </Field>
        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={busy || !ready}>
          {busy ? 'Creando…' : 'Crear grupo'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Ya tienes usuario?{' '}
        <Link to="/entrar" className="font-medium text-primary underline-offset-4 hover:underline">
          Entra
        </Link>
      </p>
    </AuthLayout>
  )
}
