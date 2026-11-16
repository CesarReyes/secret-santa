import {
  decryptPrivateKey,
  encryptPrivateKey,
  exportPublicKey,
  generateKeyPair,
  keyId,
  publicKeyOf,
} from '@shared/crypto'
import { accounts } from '@/lib/accounts'
import { supabase } from '@/lib/supabase'
import { loadLocalKey, saveLocalKey, type LocalKey } from '@/lib/keystore'

export type KeyOutcome = 'ready' | 'restored' | 'created' | 'replaced'

async function pepper(): Promise<string> {
  return (await accounts('pepper', {})).pepper
}

async function remoteKeys(userId: string) {
  const [{ data: pub, error: e1 }, { data: backup, error: e2 }] = await Promise.all([
    supabase.from('user_keys').select('public_key, key_id').eq('user_id', userId).maybeSingle(),
    supabase.from('key_backups').select('salt, iv, ciphertext').eq('user_id', userId).maybeSingle(),
  ])
  if (e1 || e2) throw new Error('No pudimos leer tus llaves. Revisa tu conexión.')
  return { pub, backup }
}

async function upload(userId: string, privateKey: CryptoKey, publicKey: string, pin: string, pep: string) {
  const backup = await encryptPrivateKey(privateKey, pin, pep)
  const now = new Date().toISOString()
  const id = await keyId(publicKey)
  const { error: e1 } = await supabase.from('user_keys').upsert({ user_id: userId, public_key: publicKey, key_id: id, updated_at: now })
  const { error: e2 } = await supabase.from('key_backups').upsert({ user_id: userId, ...backup, updated_at: now })
  if (e1 || e2) throw new Error('No pudimos guardar tus llaves. Inténtalo de nuevo.')
  return id
}

/**
 * Makes sure this device holds my private key and that the backup is encrypted with `pin`.
 * Call it only right after `pin` was verified by signing in: then a backup that won't open with
 * it means the PIN was reset, and the old key is gone for good.
 */
export async function ensureKeys(userId: string, pin: string): Promise<KeyOutcome> {
  const [local, { pub, backup }, pep] = await Promise.all([loadLocalKey(userId), remoteKeys(userId), pepper()])

  if (pub && backup) {
    try {
      const privateKey = await decryptPrivateKey(backup, pin, pep)
      if ((await publicKeyOf(privateKey)) === pub.public_key) {
        await saveLocalKey({ userId, privateKey, publicKey: pub.public_key, keyId: pub.key_id })
        return local?.keyId === pub.key_id ? 'ready' : 'restored'
      }
    } catch (e) {
      if (!(e instanceof DOMException)) throw e // network/other errors must not cost a key
    }
    // The backup is locked with another PIN. If this device still has the key, re-lock it.
    if (local && local.keyId === pub.key_id) {
      await upload(userId, local.privateKey, local.publicKey, pin, pep)
      return 'ready'
    }
  }

  const pair = await generateKeyPair()
  const publicKey = await exportPublicKey(pair.publicKey)
  const id = await upload(userId, pair.privateKey, publicKey, pin, pep)
  await saveLocalKey({ userId, privateKey: pair.privateKey, publicKey, keyId: id })
  return pub ? 'replaced' : 'created'
}

/** My key on this device, if any. */
export function myLocalKey(userId: string): Promise<LocalKey | null> {
  return loadLocalKey(userId)
}
