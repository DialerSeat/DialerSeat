// =============================================================================
// API KEYS — generation, hashing, parsing
// =============================================================================
// Shape:  sk_test_<32 base62>   secret, server only, stored as a sha256 hash
//         sk_live_<32 base62>
//         pk_test_<24 base62>   publishable, safe in a browser, stored as written
//         pk_live_<24 base62>
//
// A secret key is shown once, on creation. After that the console shows only
// its prefix and last four characters, which is all anybody needs to tell two
// keys apart. 32 base62 characters is ~190 bits; a hash lookup on a key that
// long needs no salt, because nobody is brute-forcing that space.
// =============================================================================

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export type KeyKind = 'secret' | 'publishable'
export type KeyEnv = 'test' | 'live'

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** Unbiased base62: bytes ≥ 248 are rejected so each symbol is equally likely. */
export function randomBase62(length: number): string {
  let out = ''
  while (out.length < length) {
    const buf = randomBytes(length * 2)
    for (const b of buf) {
      if (b >= 248) continue
      out += ALPHABET[b % 62]
      if (out.length === length) break
    }
  }
  return out
}

export function keyPrefix(kind: KeyKind, env: KeyEnv): string {
  return `${kind === 'secret' ? 'sk' : 'pk'}_${env}_`
}

export interface GeneratedKey {
  /** The full key. Return it to the creator once; never store it for a secret key. */
  key: string
  prefix: string
  last4: string
  /** sha256 hex of the full key. Stored for secret keys. */
  hash: string
}

export function generateKey(kind: KeyKind, env: KeyEnv): GeneratedKey {
  const prefix = keyPrefix(kind, env)
  const key = prefix + randomBase62(kind === 'secret' ? 32 : 24)
  return { key, prefix, last4: key.slice(-4), hash: hashKey(key) }
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex')
}

/** Constant-time comparison of a presented key against a stored hash. */
export function keyMatchesHash(key: string, storedHash: string): boolean {
  const a = Buffer.from(hashKey(key), 'hex')
  const b = Buffer.from(storedHash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

const KEY_RE = /^(sk|pk)_(test|live)_([0-9A-Za-z]{24,64})$/

export interface ParsedKey { kind: KeyKind; env: KeyEnv }

/** Recognise a key's kind and environment from its text alone. Null if malformed. */
export function parseKey(key: string): ParsedKey | null {
  const m = KEY_RE.exec(key.trim())
  if (!m) return null
  return { kind: m[1] === 'sk' ? 'secret' : 'publishable', env: m[2] as KeyEnv }
}

/** What the console shows after creation: sk_test_••••Ab12 */
export function maskKey(prefix: string, last4: string): string {
  return `${prefix}••••${last4}`
}

/** Webhook signing secret: whsec_<32 base62>. */
export function generateWebhookSecret(): string {
  return 'whsec_' + randomBase62(32)
}
