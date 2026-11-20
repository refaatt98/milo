/*
 * Notebook lock: the password never leaves the device and is never stored.
 * PBKDF2 (SHA-256, 210k iterations) derives an AES-GCM key; page content is
 * stored only encrypted (locally and in the cloud) while a notebook is locked.
 */
const enc = new TextEncoder()
const dec = new TextDecoder()
const CHECK = 'milonote-lock-v1'

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export async function deriveKey(password: string, saltB64: string) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: 210_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptJSON(key: CryptoKey, value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)))
  return { iv: b64(iv), data: b64(data) }
}

export async function decryptJSON<T>(key: CryptoKey, box: { iv: string; data: string }): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.data))
  return JSON.parse(dec.decode(plain)) as T
}

/** Creates lock metadata (salt + encrypted check value) and the key. */
export async function createLock(password: string) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)))
  const key = await deriveKey(password, salt)
  const box = await encryptJSON(key, CHECK)
  return { key, lock: { salt, check: box.data, iv: box.iv } }
}

/** Returns the key if the password is right, otherwise null. */
export async function openLock(password: string, lock: { salt: string; check: string; iv: string }) {
  try {
    const key = await deriveKey(password, lock.salt)
    const v = await decryptJSON<string>(key, { iv: lock.iv, data: lock.check })
    return v === CHECK ? key : null
  } catch {
    return null
  }
}

/** Unlocked keys live only in memory for this tab. */
export const unlockedKeys = new Map<string, CryptoKey>()
