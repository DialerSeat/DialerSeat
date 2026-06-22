// =============================================================================
// lib/tokenCrypto.ts — encryption at rest for Gmail OAuth tokens
// =============================================================================
// THE PROBLEM (Step 9):
//   gmail_oauth_tokens.access_token and .refresh_token were stored as plaintext.
//   Anyone with read access to that table (a leaked service-role key, a SQL
//   injection elsewhere, a backup that lands somewhere it shouldn't, a support
//   engineer browsing the dashboard) could read a user's live Google tokens and
//   impersonate them against Gmail. Refresh tokens are especially dangerous
//   because they're long-lived.
//
// THE FIX:
//   Encrypt both token columns with AES-256-GCM before they're written, and
//   decrypt them on read. GCM is authenticated encryption: it both hides the
//   value AND detects tampering (a modified ciphertext fails to decrypt rather
//   than silently returning garbage).
//
// THE KEY:
//   A 32-byte key supplied via GMAIL_TOKEN_ENCRYPTION_KEY (base64 or hex),
//   server-side only — never NEXT_PUBLIC. Generate one with:
//       openssl rand -base64 32
//   Store it in Vercel env. If this key is ever rotated, existing ciphertexts
//   become undecryptable, so rotation requires a re-encrypt migration (see
//   scripts/encrypt-gmail-tokens.ts for the pattern).
//
// STORAGE FORMAT:
//   Encrypted values are stored as a single string:
//       enc:v1:<base64(iv)>:<base64(authTag)>:<base64(ciphertext)>
//   The "enc:v1:" prefix lets us tell encrypted values from legacy plaintext at
//   a glance, which is what makes the migration safe and reversible-in-place.
//   decrypt() returns plaintext untouched if it lacks the prefix, so the system
//   keeps working with a mix of encrypted and not-yet-migrated rows.
// =============================================================================

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const PREFIX = 'enc:v1:'
const IV_BYTES = 12 // 96-bit nonce, the standard/recommended size for GCM

let cachedKey: Buffer | null = null

/**
 * Resolves the 32-byte encryption key from GMAIL_TOKEN_ENCRYPTION_KEY.
 * Accepts base64 or hex. Cached after first resolution.
 * Throws if the key is missing or the wrong length — we NEVER silently fall
 * back to storing plaintext, because that would defeat the entire purpose.
 */
function getKey(): Buffer {
  if (cachedKey) return cachedKey

  const raw = process.env.GMAIL_TOKEN_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'GMAIL_TOKEN_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` ' +
      'and add it to your environment before using Gmail token storage.'
    )
  }

  // Try base64 first, then hex. A 32-byte key is 44 chars in base64 or 64 in hex.
  let key: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex')
  } else {
    key = Buffer.from(raw, 'base64')
  }

  if (key.length !== 32) {
    throw new Error(
      `GMAIL_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}). ` +
      'Generate a valid key with `openssl rand -base64 32`.'
    )
  }

  cachedKey = key
  return key
}

/**
 * Returns true if a stored value is in our encrypted format.
 * Used by the migration and by decrypt() to handle mixed plaintext/encrypted
 * data during the transition.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

/**
 * Encrypts a plaintext string. Returns the "enc:v1:iv:tag:ciphertext" form.
 * Each call uses a fresh random IV, so encrypting the same token twice yields
 * different ciphertexts (correct GCM usage — never reuse an IV with a key).
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [
    PREFIX.slice(0, -1), // "enc:v1" (we re-join with ":" below)
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':')
}

/**
 * Decrypts a value produced by encrypt(). If the value is NOT in encrypted
 * form (legacy plaintext, or null), it's returned unchanged — this is what
 * allows the app to keep working while old rows are migrated. A value that
 * claims to be encrypted but fails authentication throws (tamper detection).
 */
export function decrypt(value: string | null): string | null {
  if (value === null || value === undefined) return value
  if (!isEncrypted(value)) {
    // Legacy plaintext (or already-decrypted). Pass through untouched.
    return value
  }

  const parts = value.split(':')
  // Expected: ["enc", "v1", iv, tag, ciphertext]
  if (parts.length !== 5) {
    throw new Error('Malformed encrypted token: wrong segment count')
  }
  const [, , ivB64, tagB64, ctB64] = parts

  const key = getKey()
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const ciphertext = Buffer.from(ctB64, 'base64')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}

/**
 * Convenience: encrypts a value that might be undefined/empty (e.g. an
 * optional refresh_token). Returns the input unchanged if it's falsy.
 */
export function encryptNullable(value: string | null | undefined): string | null {
  if (!value) return value ?? null
  return encrypt(value)
}