import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type Actions = {
  register: {
    in: { username: string; display_name: string; pin: string; group_name: string }
    out: { user_id: string; group_id: string }
  }
  create_member: {
    in: { group_id: string; username: string; display_name: string }
    out: { user_id: string; username: string; temp_pin: string }
  }
  reset_pin: { in: { group_id: string; user_id: string }; out: { user_id: string; temp_pin: string } }
  change_pin: { in: { new_pin: string }; out: { ok: true } }
}

/** Calls the `accounts` Edge Function and surfaces its Spanish error message. */
export async function accounts<A extends keyof Actions>(action: A, payload: Actions[A]['in']): Promise<Actions[A]['out']> {
  const { data, error } = await supabase.functions.invoke('accounts', { body: { action, ...payload } })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null)
      throw new Error(body?.error ?? 'Algo salió mal. Inténtalo de nuevo.')
    }
    throw new Error('No hay conexión. Inténtalo de nuevo.')
  }
  return data
}
