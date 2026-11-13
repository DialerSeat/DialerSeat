// =============================================================================
// API KEYS — DialerSeat's own format, with a checksum
// =============================================================================
//   dsk_test_<28 random><6 checksum>   secret, server only, stored as a sha256 hash
//   dsk_live_<28 random><6 checksum>
//   dpk_test_<22 random><6 checksum>   publishable, safe in a browser, stored as written
//   dpk_live_<22 random><6 checksum>
//   dswh_<32 random>                   webhook signing secret
//
// WHY ITS OWN PREFIX. sk_/pk_ is Stripe's. A developer pasting the wrong one
// into the wrong place, or a scanner deciding which vendor a leaked key
// belongs to, should never have to guess: dsk_ is a DialerSeat secret key
// and nothing else.
//
// WHY A CHECKSUM. The last six characters are a CRC32 of everything before
// them, in base62 (the scheme GitHub uses for its tokens). A key with a typo,
// a missing character or a truncated paste fails the check before any
// database lookup, with a message that says so, and a string that merely
// looks like a key can be told from one of ours offline.
//
// A secret key is shown once, on creation. After that the console shows only
// its prefix and last four characters. 28 base62 characters is ~166 bits.
// =============================================================================

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export type KeyKind = 'secret' | 'publishable'
export type KeyEnv = 'test' | 'live'

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const RANDOM_LEN: Record<KeyKind, number> = { secret: 28, publishable: 22 }
const CHECKSUM_LEN = 6

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

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(s: string): number {
  let c = 0xffffffff
  for (const byte of Buffer.from(s, 'utf8')) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** CRC32 as six base62 characters (62^6 > 2^32, so it always fits). */
export function checksum(s: string): string {
  let n = crc32(s)
  let out = ''
  for (let i = 0; i < CHECKSUM_LEN; i++) { out = ALPHABET[n % 62] + out; n = Math.floor(n / 62) }
  return out
}

export function keyPrefix(kind: KeyKind, env: KeyEnv): string {
  return `${kind === 'secret' ? 'dsk' : 'dpk'}_${env}_`
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
  const body = prefix + randomBase62(RANDOM_LEN[kind])
  const key = body + checksum(body)
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

const KEY_RE = /^(dsk|dpk)_(test|live)_([0-9A-Za-z]+)$/

export interface ParsedKey { kind: KeyKind; env: KeyEnv }
export type KeyCheck = { ok: true; key: ParsedKey } | { ok: false; reason: 'not_a_key' | 'wrong_length' | 'bad_checksum' }

/** Recognise a key's kind and environment from its text alone, checksum included. */
export function checkKey(raw: string): KeyCheck {
  const key = raw.trim()
  const m = KEY_RE.exec(key)
  if (!m) return { ok: false, reason: 'not_a_key' }
  const kind: KeyKind = m[1] === 'dsk' ? 'secret' : 'publishable'
  if (m[3].length !== RANDOM_LEN[kind] + CHECKSUM_LEN) return { ok: false, reason: 'wrong_length' }
  const body = key.slice(0, -CHECKSUM_LEN)
  if (checksum(body) !== key.slice(-CHECKSUM_LEN)) return { ok: false, reason: 'bad_checksum' }
  return { ok: true, key: { kind, env: m[2] as KeyEnv } }
}

/** The same check, as kind and environment or null. */
export function parseKey(raw: string): ParsedKey | null {
  const c = checkKey(raw)
  return c.ok ? c.key : null
}

/** What the console shows after creation: dsk_test_••••Ab12 */
export function maskKey(prefix: string, last4: string): string {
  return `${prefix}••••${last4}`
}

/** Webhook signing secret: dswh_<32 base62>. */
export function generateWebhookSecret(): string {
  return 'dswh_' + randomBase62(32)
}
