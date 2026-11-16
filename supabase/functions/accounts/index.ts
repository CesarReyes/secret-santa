// Accounts: the only place where users are created or their PIN is set.
//
//   register      (public)  create my account + my first group, I become its owner
//   create_member (admin)   create an account with a temporary PIN and add it to my group
//   reset_pin     (admin)   give a member a new temporary PIN
//   change_pin    (self)    set my own PIN and clear the "must change" flag
//
// A temporary PIN sets app_metadata.must_change_pin, which only the service role can write, so the
// forced change cannot be skipped from the browser console.

import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'
import {
  generateTempPin,
  isValidUsername,
  normalizeUsername,
  usernameToEmail,
  validateNewPin,
} from '../_shared/account-rules.ts'

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

// Regular (non-admin) client, only used to check whether a PIN is the current one.
const probe = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido.')
    const body = await req.json().catch(() => {
      throw new HttpError(400, 'Petición inválida.')
    })
    const result = await route(req, body)
    return json(200, result)
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message })
    console.error(e)
    return json(500, { error: 'Algo salió mal. Inténtalo de nuevo.' })
  }
})

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
async function route(req: Request, body: any) {
  switch (body?.action) {
    case 'register':
      return register(body)
    case 'create_member':
      return createMember(await caller(req), body)
    case 'reset_pin':
      return resetPin(await caller(req), body)
    case 'change_pin':
      return changePin(await caller(req), body)
    default:
      throw new HttpError(400, 'Acción desconocida.')
  }
}

async function caller(req: Request): Promise<User> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Inicia sesión.')
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Tu sesión expiró. Vuelve a entrar.')
  return data.user
}

function cleanUsername(raw: unknown): string {
  const username = normalizeUsername(String(raw ?? ''))
  if (!isValidUsername(username)) {
    throw new HttpError(400, 'El usuario debe tener de 3 a 24 letras, números, puntos o guiones, sin espacios.')
  }
  return username
}

function cleanName(raw: unknown, what: string, max: number): string {
  const name = String(raw ?? '').trim()
  if (!name || name.length > max) throw new HttpError(400, `Escribe ${what} (máximo ${max} caracteres).`)
  return name
}

/** Creates the auth user and its profile; rolls the user back if the profile fails. */
async function createAccount(username: string, displayName: string, pin: string, mustChange: boolean) {
  const { data, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password: pin,
    email_confirm: true,
    app_metadata: { must_change_pin: mustChange },
    user_metadata: { username },
  })
  if (error) {
    if (/already|registered|exists/i.test(error.message)) throw new HttpError(409, `El usuario "${username}" ya existe.`)
    throw error
  }
  const user = data.user
  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: user.id, username, display_name: displayName, pin_pending: mustChange })
  if (profileError) {
    await admin.auth.admin.deleteUser(user.id)
    if (profileError.code === '23505') throw new HttpError(409, `El usuario "${username}" ya existe.`)
    throw profileError
  }
  return user
}

// deno-lint-ignore no-explicit-any
async function register(body: any) {
  const username = cleanUsername(body.username)
  const displayName = cleanName(body.display_name, 'tu nombre', 40)
  const groupName = cleanName(body.group_name, 'el nombre del grupo', 60)
  const pin = String(body.pin ?? '')
  const pinError = validateNewPin(pin)
  if (pinError) throw new HttpError(400, pinError)

  const user = await createAccount(username, displayName, pin, false)
  const { data: group, error } = await admin
    .from('groups')
    .insert({ name: groupName, created_by: user.id })
    .select('id')
    .single()
  if (error) {
    await admin.auth.admin.deleteUser(user.id)
    throw error
  }
  await must(admin.from('group_members').insert({ group_id: group.id, user_id: user.id, role: 'owner' }))
  return { user_id: user.id, group_id: group.id }
}

async function roleIn(db: SupabaseClient, groupId: string, userId: string): Promise<string | null> {
  const { data, error } = await db
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.role ?? null
}

async function requireAdmin(groupId: unknown, user: User): Promise<{ groupId: string; role: string }> {
  if (typeof groupId !== 'string') throw new HttpError(400, 'Falta el grupo.')
  const role = await roleIn(admin, groupId, user.id)
  if (role !== 'owner' && role !== 'admin') throw new HttpError(403, 'Solo los administradores pueden hacer esto.')
  return { groupId, role }
}

// deno-lint-ignore no-explicit-any
async function createMember(user: User, body: any) {
  const { groupId } = await requireAdmin(body.group_id, user)
  const { data: group } = await admin.from('groups').select('status').eq('id', groupId).single()
  if (group?.status !== 'open') throw new HttpError(409, 'El sorteo ya se hizo. Rehazlo para sumar a alguien.')

  const username = cleanUsername(body.username)
  const displayName = cleanName(body.display_name, 'el nombre', 40)
  const pin = generateTempPin()
  const member = await createAccount(username, displayName, pin, true)
  await must(admin.from('group_members').insert({ group_id: groupId, user_id: member.id, role: 'member' }))
  return { user_id: member.id, username, temp_pin: pin }
}

const RANK: Record<string, number> = { member: 0, admin: 1, owner: 2 }

// deno-lint-ignore no-explicit-any
async function resetPin(user: User, body: any) {
  const { groupId, role } = await requireAdmin(body.group_id, user)
  const targetId = String(body.user_id ?? '')
  if (targetId === user.id) throw new HttpError(400, 'Para cambiar tu propio PIN usa "Cambiar PIN".')

  const targetRole = await roleIn(admin, groupId, targetId)
  if (targetRole === null) throw new HttpError(404, 'Esa persona no está en el grupo.')
  if (RANK[targetRole] >= RANK[role]) throw new HttpError(403, 'No puedes restablecer el PIN de alguien con tu mismo rol o superior.')

  // Resetting someone who runs another group would hand that group to this admin.
  const { data: elsewhere, error } = await admin
    .from('group_members')
    .select('group_id')
    .eq('user_id', targetId)
    .in('role', ['owner', 'admin'])
    .neq('group_id', groupId)
    .limit(1)
  if (error) throw error
  if (elsewhere.length > 0) throw new HttpError(403, 'Esa persona administra otro grupo; solo ella puede cambiar su PIN.')

  const pin = generateTempPin()
  const { error: updateError } = await admin.auth.admin.updateUserById(targetId, {
    password: pin,
    app_metadata: { must_change_pin: true },
  })
  if (updateError) throw updateError
  await must(admin.from('profiles').update({ pin_pending: true }).eq('id', targetId))
  return { user_id: targetId, temp_pin: pin }
}

// deno-lint-ignore no-explicit-any
async function changePin(user: User, body: any) {
  const pin = String(body.new_pin ?? '')
  const pinError = validateNewPin(pin)
  if (pinError) throw new HttpError(400, pinError)

  // Re-using the current PIN would clear the flag while the admin still knows it. The admin API
  // doesn't reject same-password updates, so probe it with a regular sign-in.
  const { error: sameError } = await probe.auth.signInWithPassword({ email: user.email!, password: pin })
  if (!sameError) throw new HttpError(400, 'Elige un PIN distinto al actual.')

  // Note: changing the password revokes every session; the app signs in again with the new PIN.
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: pin,
    app_metadata: { must_change_pin: false },
  })
  if (error) throw error
  await must(admin.from('profiles').update({ pin_pending: false }).eq('id', user.id))
  return { ok: true }
}

async function must(query: PromiseLike<{ error: unknown }>) {
  const { error } = await query
  if (error) throw error
}
