// The draw. Runs on the server, not in an admin's browser, so no admin ever sees the pairs.
//
//   run   (admin)  draw and store one sealed assignment per giver
//
// The pairs exist only in this function's memory for a moment: each receiver id is sealed with the
// giver's public key before it is written, and nothing about the pairs is logged or returned.
// Undoing a draw is a plain RPC (undo_draw) because it needs no secrets.

import { createClient, type User } from 'npm:@supabase/supabase-js@2'
import { seal } from '../_shared/crypto.ts'
import { drawAssignments, type Pair } from '../_shared/draw.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido.')
    const body = await req.json().catch(() => ({}))
    if (body?.action !== 'run') throw new HttpError(400, 'Acción desconocida.')
    return json(200, await run(await caller(req), body.group_id))
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message })
    // Never log anything that could contain pairs; errors here come from the database or crypto.
    console.error('draw failed:', e instanceof Error ? e.message : 'unknown error')
    return json(500, { error: 'Algo salió mal. Inténtalo de nuevo.' })
  }
})

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

async function caller(req: Request): Promise<User> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Inicia sesión.')
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Tu sesión expiró. Vuelve a entrar.')
  return data.user
}

async function run(user: User, groupId: unknown) {
  if (typeof groupId !== 'string') throw new HttpError(400, 'Falta el grupo.')

  const { data: me } = await admin
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (me?.role !== 'owner' && me?.role !== 'admin') throw new HttpError(403, 'Solo los administradores pueden hacer el sorteo.')

  const { data: group, error: groupError } = await admin.from('groups').select('status').eq('id', groupId).single()
  if (groupError) throw groupError
  if (group.status !== 'open') throw new HttpError(409, 'El sorteo ya está hecho. Deshazlo para repetirlo.')

  const { data: members, error: membersError } = await admin
    .from('group_members')
    .select('user_id, profiles(display_name, pin_pending)')
    .eq('group_id', groupId)
  if (membersError) throw membersError
  if (members.length < 3) throw new HttpError(409, 'Hacen falta al menos 3 participantes.')

  const ids = members.map((m) => m.user_id as string)
  const { data: keyRows, error: keysError } = await admin.from('user_keys').select('user_id, public_key, key_id').in('user_id', ids)
  if (keysError) throw keysError
  const keys = new Map(keyRows.map((k) => [k.user_id as string, k as { public_key: string; key_id: string }]))

  const profiles = members as unknown as { user_id: string; profiles: { display_name: string; pin_pending: boolean } | null }[]
  const notReady = profiles.filter((m) => m.profiles?.pin_pending || !keys.has(m.user_id)).map((m) => m.profiles?.display_name ?? '?')
  if (notReady.length) {
    throw new HttpError(409, `Aún no han entrado a la app: ${notReady.join(', ')}. Cada quien debe entrar una vez antes del sorteo.`)
  }

  const { data: exclusions, error: exclusionsError } = await admin.from('exclusions').select('a, b').eq('group_id', groupId)
  if (exclusionsError) throw exclusionsError

  const result = drawAssignments(
    ids,
    exclusions.map((e) => [e.a, e.b] as Pair),
  )
  if (!result) throw new HttpError(409, 'Con estas exclusiones no hay forma de repartir. Quita alguna.')

  const sealed = await Promise.all(
    [...result].map(async ([giver, receiver]) => ({
      giver_id: giver,
      key_id: keys.get(giver)!.key_id,
      ciphertext: await seal(keys.get(giver)!.public_key, JSON.stringify({ v: 1, receiver }), `${groupId}:${giver}`),
    })),
  )
  result.clear()

  const { error } = await admin.rpc('store_draw', { p_group: groupId, p_rows: sealed })
  if (error) throw error
  return { ok: true, participants: sealed.length }
}
