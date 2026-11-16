// End-to-end crypto for the draw, shared by the browser (src/) and the Edge Functions (Deno).
// WebCrypto only, no dependencies.
//
//   Keys      ECDH P-256 per person. Public key in the database, private key on the device.
//   Seal      "sealed box": ephemeral ECDH + HKDF-SHA256 + AES-256-GCM. Only the holder of the
//             private key can open it. Used for each draw assignment.
//   Backup    the private key, encrypted with a key derived from the person's PIN (PBKDF2) AND a
//             server-side pepper, so a database dump alone can't brute-force 6-digit PINs.

export type Bytes = Uint8Array<ArrayBuffer>

const subtle = globalThis.crypto.subtle
const enc = new TextEncoder()
const dec = new TextDecoder()

const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const
const PUBLIC_KEY_BYTES = 65 // uncompressed P-256 point
const IV_BYTES = 12
export const PBKDF2_ITERATIONS = 600_000

const SEAL_INFO = 'amigo-secreto/seal/v1'
const BACKUP_INFO = 'amigo-secreto/backup/v1'

// ---------------------------------------------------------------------------------------------
// Bytes helpers
// ---------------------------------------------------------------------------------------------

export function randomBytes(n: number): Bytes {
  return globalThis.crypto.getRandomValues(new Uint8Array(n))
}

export function toB64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export function fromB64(b64: string): Bytes {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

async function hkdfAesKey(ikm: Bytes, salt: Bytes, info: string): Promise<CryptoKey> {
  const base = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey'])
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(info) },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ---------------------------------------------------------------------------------------------
// Key pairs
// ---------------------------------------------------------------------------------------------

/** Extractable so the private key can be re-encrypted when the PIN changes. */
export function generateKeyPair(): Promise<CryptoKeyPair> {
  return subtle.generateKey(ECDH, true, ['deriveBits']) as Promise<CryptoKeyPair>
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  return toB64(new Uint8Array(await subtle.exportKey('raw', key)))
}

function importPublicKey(raw: Bytes): Promise<CryptoKey> {
  return subtle.importKey('raw', raw, ECDH, true, [])
}

/** Short fingerprint of a public key: tells whether an assignment was sealed for my current key. */
export async function keyId(publicKeyB64: string): Promise<string> {
  const digest = new Uint8Array(await subtle.digest('SHA-256', fromB64(publicKeyB64)))
  return [...digest.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------------------------------
// Sealed box
// ---------------------------------------------------------------------------------------------

/**
 * Encrypts `plaintext` so only the owner of `recipientPublicKeyB64` can read it. `aad` binds the
 * ciphertext to its row (e.g. "group:giver"), so it can't be moved to another row and still open.
 */
export async function seal(recipientPublicKeyB64: string, plaintext: string, aad: string): Promise<string> {
  const recipient = await importPublicKey(fromB64(recipientPublicKeyB64))
  const ephemeral = await generateKeyPair()
  const ephemeralRaw = new Uint8Array(await subtle.exportKey('raw', ephemeral.publicKey))
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: recipient }, ephemeral.privateKey, 256))
  const key = await hkdfAesKey(shared, ephemeralRaw, SEAL_INFO)
  const iv = randomBytes(IV_BYTES)
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(plaintext))
  return toB64(concat(ephemeralRaw, iv, new Uint8Array(ct)))
}

/** Opens a sealed box. Throws if the key, the ciphertext or the `aad` don't match. */
export async function open(privateKey: CryptoKey, sealed: string, aad: string): Promise<string> {
  const bytes = fromB64(sealed)
  const ephemeral = await importPublicKey(bytes.slice(0, PUBLIC_KEY_BYTES))
  const iv = bytes.slice(PUBLIC_KEY_BYTES, PUBLIC_KEY_BYTES + IV_BYTES)
  const ct = bytes.slice(PUBLIC_KEY_BYTES + IV_BYTES)
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: ephemeral }, privateKey, 256))
  const key = await hkdfAesKey(shared, bytes.slice(0, PUBLIC_KEY_BYTES), SEAL_INFO)
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, ct)
  return dec.decode(pt)
}

// ---------------------------------------------------------------------------------------------
// Private key backup (PIN + pepper)
// ---------------------------------------------------------------------------------------------

export type KeyBackup = { salt: string; iv: string; ciphertext: string }

async function backupKey(pin: string, salt: Bytes, pepperB64: string, iterations: number): Promise<CryptoKey> {
  const pinKey = await subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const pinBits = new Uint8Array(
    await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, pinKey, 256),
  )
  return hkdfAesKey(concat(pinBits, fromB64(pepperB64)), salt, BACKUP_INFO)
}

export async function encryptPrivateKey(
  privateKey: CryptoKey,
  pin: string,
  pepperB64: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<KeyBackup> {
  const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', privateKey))
  const salt = randomBytes(16)
  const iv = randomBytes(IV_BYTES)
  const key = await backupKey(pin, salt, pepperB64, iterations)
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(BACKUP_INFO) }, key, pkcs8)
  return { salt: toB64(salt), iv: toB64(iv), ciphertext: toB64(new Uint8Array(ct)) }
}

/** Throws (OperationError) if the PIN or pepper is wrong. */
export async function decryptPrivateKey(
  backup: KeyBackup,
  pin: string,
  pepperB64: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const key = await backupKey(pin, fromB64(backup.salt), pepperB64, iterations)
  const pkcs8 = await subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(backup.iv), additionalData: enc.encode(BACKUP_INFO) },
    key,
    fromB64(backup.ciphertext),
  )
  return subtle.importKey('pkcs8', pkcs8, ECDH, true, ['deriveBits'])
}

/** Derives the public key from a private one (via JWK) to check it matches what's stored. */
export async function publicKeyOf(privateKey: CryptoKey): Promise<string> {
  const jwk = await subtle.exportKey('jwk', privateKey)
  const pub = await subtle.importKey('jwk', { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true }, ECDH, true, [])
  return exportPublicKey(pub)
}

// ---------------------------------------------------------------------------------------------
// Server-side pepper (Edge Function only)
// ---------------------------------------------------------------------------------------------

/** HMAC-SHA256(secret, userId). Same user always gets the same pepper; the secret never leaves the server. */
export async function pepperFor(secretB64: string, userId: string): Promise<string> {
  const key = await subtle.importKey('raw', fromB64(secretB64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toB64(new Uint8Array(await subtle.sign('HMAC', key, enc.encode(userId))))
}
