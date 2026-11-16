import { describe, expect, it } from 'vitest'
import {
  decryptPrivateKey,
  encryptPrivateKey,
  exportPublicKey,
  generateKeyPair,
  keyId,
  open,
  pepperFor,
  publicKeyOf,
  randomBytes,
  seal,
  toB64,
} from '@shared/crypto'

// Fewer PBKDF2 rounds keep the suite fast; production uses PBKDF2_ITERATIONS.
const FAST = 1_000

describe('sealed box', () => {
  it('only the recipient opens it', async () => {
    const ana = await generateKeyPair()
    const beto = await generateKeyPair()
    const sealed = await seal(await exportPublicKey(ana.publicKey), '{"receiver":"carla"}', 'g1:ana')

    expect(await open(ana.privateKey, sealed, 'g1:ana')).toBe('{"receiver":"carla"}')
    await expect(open(beto.privateKey, sealed, 'g1:ana')).rejects.toThrow()
  })

  it('is bound to its row: a ciphertext moved to another giver does not open', async () => {
    const ana = await generateKeyPair()
    const sealed = await seal(await exportPublicKey(ana.publicKey), 'secreto', 'g1:ana')
    await expect(open(ana.privateKey, sealed, 'g1:beto')).rejects.toThrow()
  })

  it('never repeats ciphertext for the same message', async () => {
    const ana = await generateKeyPair()
    const pub = await exportPublicKey(ana.publicKey)
    expect(await seal(pub, 'x', 'a')).not.toBe(await seal(pub, 'x', 'a'))
  })
})

describe('private key backup', () => {
  it('restores with the right PIN and pepper only', async () => {
    const pair = await generateKeyPair()
    const pepper = toB64(randomBytes(32))
    const backup = await encryptPrivateKey(pair.privateKey, '482915', pepper, FAST)

    const restored = await decryptPrivateKey(backup, '482915', pepper, FAST)
    expect(await publicKeyOf(restored)).toBe(await exportPublicKey(pair.publicKey))

    await expect(decryptPrivateKey(backup, '482916', pepper, FAST)).rejects.toThrow()
    await expect(decryptPrivateKey(backup, '482915', toB64(randomBytes(32)), FAST)).rejects.toThrow()
  })

  it('a restored key opens what was sealed for the original', async () => {
    const pair = await generateKeyPair()
    const pepper = toB64(randomBytes(32))
    const sealed = await seal(await exportPublicKey(pair.publicKey), 'hola', 'aad')
    const restored = await decryptPrivateKey(await encryptPrivateKey(pair.privateKey, 'pin-largo', pepper, FAST), 'pin-largo', pepper, FAST)
    expect(await open(restored, sealed, 'aad')).toBe('hola')
  })
})

describe('pepper and key ids', () => {
  it('pepper is stable per user and differs between users', async () => {
    const secret = toB64(randomBytes(32))
    expect(await pepperFor(secret, 'u1')).toBe(await pepperFor(secret, 'u1'))
    expect(await pepperFor(secret, 'u1')).not.toBe(await pepperFor(secret, 'u2'))
  })

  it('key id is a short stable fingerprint', async () => {
    const pub = await exportPublicKey((await generateKeyPair()).publicKey)
    expect(await keyId(pub)).toMatch(/^[0-9a-f]{16}$/)
    expect(await keyId(pub)).toBe(await keyId(pub))
  })
})
