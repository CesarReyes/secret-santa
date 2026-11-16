// Device-local storage of my private key (IndexedDB keeps CryptoKey objects as they are).

export type LocalKey = { userId: string; privateKey: CryptoKey; publicKey: string; keyId: string }

const DB = 'amigo-secreto'
const STORE = 'keys'

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const conn = await db()
  return new Promise((resolve, reject) => {
    const req = run(conn.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).finally(() => conn.close()) as Promise<T>
}

export async function loadLocalKey(userId: string): Promise<LocalKey | null> {
  try {
    return ((await tx('readonly', (s) => s.get(userId))) as LocalKey | undefined) ?? null
  } catch {
    return null // storage blocked (private mode): the PIN unlocks the backup instead
  }
}

export async function saveLocalKey(key: LocalKey): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(key, key.userId))
  } catch {
    // Not fatal: without local storage the person types their PIN to see the draw.
  }
}
