import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { usernameToEmail } from '@shared/account-rules'
import { supabase } from '@/lib/supabase'
import { accounts } from '@/lib/accounts'

type AuthState = {
  ready: boolean
  session: Session | null
  signIn: (username: string, pin: string) => Promise<void>
  signOut: () => Promise<void>
  /** Sets a new PIN. The server revokes every session, so we sign in again with it. */
  changePin: (newPin: string) => Promise<void>
}

export const useAuth = create<AuthState>((_set, get) => ({
  ready: false,
  session: null,

  async signIn(username, pin) {
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password: pin })
    if (error) {
      if (error.status === 429) throw new Error('Demasiados intentos. Espera unos minutos.')
      throw new Error('Usuario o PIN incorrectos.')
    }
  },

  async signOut() {
    await supabase.auth.signOut()
  },

  async changePin(newPin) {
    const email = get().session?.user.email
    if (!email) throw new Error('Inicia sesión de nuevo.')
    await accounts('change_pin', { new_pin: newPin })
    const { error } = await supabase.auth.signInWithPassword({ email, password: newPin })
    if (error) throw new Error('Tu PIN cambió, pero no pudimos entrar. Entra con el PIN nuevo.')
  },
}))

/** True while the user still has a temporary PIN set by an admin. */
export function mustChangePin(session: Session | null): boolean {
  return session?.user.app_metadata?.must_change_pin === true
}

supabase.auth.getSession().then(({ data }) => useAuth.setState({ ready: true, session: data.session }))
supabase.auth.onAuthStateChange((_event, session) => useAuth.setState({ ready: true, session }))
