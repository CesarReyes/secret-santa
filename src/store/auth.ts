import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { usernameToEmail } from '@shared/account-rules'
import { supabase } from '@/lib/supabase'
import { accounts } from '@/lib/accounts'
import { ensureKeys } from '@/lib/keys'

type AuthState = {
  ready: boolean
  session: Session | null
  signIn: (username: string, pin: string) => Promise<void>
  /** Re-checks my PIN and restores my key on this device (e.g. after clearing site data). */
  unlock: (pin: string) => Promise<void>
  signOut: () => Promise<void>
  /** Sets a new PIN. The server revokes every session, so we sign in again with it. */
  changePin: (newPin: string) => Promise<void>
}

/** Right after a verified sign-in, make sure my draw key is on this device and locked with this PIN. */
async function syncKeys(session: Session | null, pin: string) {
  if (!session || mustChangePin(session)) return // keys are created once the person picks their own PIN
  try {
    const outcome = await ensureKeys(session.user.id, pin)
    if (outcome === 'replaced') {
      toast.warning('Tu llave del sorteo es nueva. Si ya había sorteo, pide a un admin que lo repita.')
    }
  } catch (e) {
    toast.error((e as Error).message)
  }
}

export const useAuth = create<AuthState>((_set, get) => ({
  ready: false,
  session: null,

  async signIn(username, pin) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password: pin })
    if (error) {
      if (error.status === 429) throw new Error('Demasiados intentos. Espera unos minutos.')
      throw new Error('Usuario o PIN incorrectos.')
    }
    await syncKeys(data.session, pin)
  },

  async unlock(pin) {
    const email = get().session?.user.email
    if (!email) throw new Error('Inicia sesión de nuevo.')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pin })
    if (error) throw new Error(error.status === 429 ? 'Demasiados intentos. Espera unos minutos.' : 'PIN incorrecto.')
    await syncKeys(data.session, pin)
  },

  async signOut() {
    await supabase.auth.signOut()
  },

  async changePin(newPin) {
    const email = get().session?.user.email
    if (!email) throw new Error('Inicia sesión de nuevo.')
    await accounts('change_pin', { new_pin: newPin })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: newPin })
    if (error) throw new Error('Tu PIN cambió, pero no pudimos entrar. Entra con el PIN nuevo.')
    await syncKeys(data.session, newPin)
  },
}))

/** True while the user still has a temporary PIN set by an admin. */
export function mustChangePin(session: Session | null): boolean {
  return session?.user.app_metadata?.must_change_pin === true
}

supabase.auth.getSession().then(({ data }) => useAuth.setState({ ready: true, session: data.session }))
supabase.auth.onAuthStateChange((_event, session) => useAuth.setState({ ready: true, session }))
