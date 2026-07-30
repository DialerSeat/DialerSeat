import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

// ─────────────────────────────────────────────────────────────────────────
// Dialer Down emergency banner — password hashing.
//
// Uses Node's built-in crypto.scrypt rather than adding a bcrypt/argon2
// dependency. scrypt is memory-hard (good resistance to brute force) and
// ships with Node itself, so no new package or network install is needed.
// The password itself is never stored — only a salt + derived hash.
// ─────────────────────────────────────────────────────────────────────────

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

export async function hashDialerDownPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer
  return { hash: derived.toString('hex'), salt }
}

export async function verifyDialerDownPassword(
  password: string,
  storedHash: string | null | undefined,
  storedSalt: string | null | undefined
): Promise<boolean> {
  if (!storedHash || !storedSalt) return false
  const derived = (await scrypt(password, storedSalt, KEY_LENGTH)) as Buffer
  const stored = Buffer.from(storedHash, 'hex')
  // Lengths must match before timingSafeEqual will even compare — a
  // mismatched length throws rather than returning false, and the derived
  // key is always KEY_LENGTH bytes, so a mismatch here just means a
  // corrupted/foreign hash rather than ever being a real match.
  if (stored.length !== derived.length) return false
  return timingSafeEqual(stored, derived)
}
