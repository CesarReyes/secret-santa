import { useState, type FormEvent } from 'react'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { Snow } from '@/components/Snow'
import { toast } from 'sonner'

// Visual shell only: username + PIN sign-in is wired to Supabase in step 2 of the plan.
export function LoginScreen() {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    toast.info('El acceso se conecta en el siguiente paso.')
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-primary px-4">
      <Snow />
      <Card className="relative w-full max-w-sm">
        <CardHeader className="text-center">
          <span className="text-5xl" aria-hidden>🎁</span>
          <CardTitle className="font-display text-2xl">Amigo Secreto</CardTitle>
          <CardDescription>Entra con el usuario y el PIN que te dieron.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">PIN</Label>
              <InputOTP id="pin" containerClassName="justify-center" maxLength={6} pattern={REGEXP_ONLY_DIGITS} value={pin} onChange={setPin} inputMode="numeric">
                <InputOTPGroup className="mx-auto">
                  {Array.from({ length: 6 }, (_, i) => (
                    <InputOTPSlot key={i} index={i} className="size-11 text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={!username || pin.length < 6}>
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
