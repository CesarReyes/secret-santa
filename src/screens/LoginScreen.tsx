import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { normalizeUsername } from '@shared/account-rules'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthLayout } from '@/components/AuthLayout'
import { Field } from '@/components/Field'
import { PinInput } from '@/components/PinInput'
import { useAuth } from '@/store/auth'

export function LoginScreen() {
  const signIn = useAuth((s) => s.signIn)
  const [params] = useSearchParams()
  const linkedUser = params.get('u')
  const [username, setUsername] = useState(linkedUser ?? '')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)

  // An access link (#/entrar?u=lucia) pre-fills the username, also when the screen is already open.
  useEffect(() => {
    if (linkedUser) {
      setUsername(linkedUser)
      document.getElementById('pin')?.focus()
    }
  }, [linkedUser])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await signIn(normalizeUsername(username), pin)
    } catch (err) {
      toast.error((err as Error).message)
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Amigo Secreto" description="Entra con tu usuario y tu PIN o contraseña.">
      <form onSubmit={submit} className="space-y-5">
        <Field id="username" label="Usuario">
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-11 text-base"
          />
        </Field>
        <Field id="pin" label="PIN o contraseña">
          <PinInput id="pin" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={busy || !username.trim() || pin.length < 6}>
          {busy ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Organizas un amigo secreto?{' '}
        <Link to="/registro" className="font-medium text-primary underline-offset-4 hover:underline">
          Crea tu grupo
        </Link>
      </p>
    </AuthLayout>
  )
}
