

































import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const PREFIX = 'enc:v1:'
const IV_BYTES = 12 // 96-bit nonce, the standard/recommended size for GCM

let cachedKey: Buffer | null = null


function getKey(): Buffer {
  if (cachedKey) return cachedKey

  const raw = process.env.GMAIL_TOKEN_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'GMAIL_TOKEN_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` ' +
      'and add it to your environment before using Gmail token storage.'
    )
  }

  
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


export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}


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


export function decrypt(value: string | null): string | null {
  if (value === null || value === undefined) return value
  if (!isEncrypted(value)) {
    
    return value
  }

  const parts = value.split(':')
  
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


export function encryptNullable(value: string | null | undefined): string | null {
  if (!value) return value ?? null
  return encrypt(value)
}