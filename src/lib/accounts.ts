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
  pepper: { in: Record<string, never>; out: { pepper: string } }
}

/** Calls an Edge Function and surfaces its Spanish error message. */
export async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null)
      throw new Error(payload?.error ?? 'Algo salió mal. Inténtalo de nuevo.')
    }
    throw new Error('No hay conexión. Inténtalo de nuevo.')
  }
  return data as T
}

/** Calls the `accounts` Edge Function. */
export function accounts<A extends keyof Actions>(action: A, payload: Actions[A]['in']): Promise<Actions[A]['out']> {
  return invoke('accounts', { action, ...payload })
}
