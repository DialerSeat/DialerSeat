













import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '@/lib/tokenCrypto'

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface GmailTokenRow {
  id: string
  clerk_id: string
  email: string
  access_token: string
  refresh_token: string
  expires_at: string // ISO timestamp
  scopes: string
  created_at: string
  updated_at: string
}





export async function requireAuth(): Promise<string> {
  const { userId } = await auth()
  if (!userId) throw new GmailAuthError('not_signed_in')
  return userId
}



export class GmailAuthError extends Error {
  constructor(public reason: 'not_signed_in' | 'not_connected' | 'refresh_failed' | 'revoked', message?: string) {
    super(message ?? reason)
    this.name = 'GmailAuthError'
  }
}




export async function getStoredTokens(clerkId: string): Promise<GmailTokenRow | null> {
  const { data, error } = await supabase
    .from('gmail_oauth_tokens')
    .select('*')
    .eq('clerk_id', clerkId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  
  
  
  
  const row = data as GmailTokenRow
  return {
    ...row,
    access_token: decrypt(row.access_token) as string,
    refresh_token: decrypt(row.refresh_token) as string,
  }
}

export async function deleteStoredTokens(clerkId: string): Promise<void> {
  const { error } = await supabase
    .from('gmail_oauth_tokens')
    .delete()
    .eq('clerk_id', clerkId)
  if (error) throw error
}

interface UpsertTokensInput {
  clerkId: string
  email: string
  accessToken: string
  refreshToken: string
  expiresInSec: number
  scopes: string
}

export async function upsertTokens(input: UpsertTokensInput): Promise<void> {
  const expiresAt = new Date(Date.now() + input.expiresInSec * 1000).toISOString()
  const { error } = await supabase.from('gmail_oauth_tokens').upsert(
    {
      clerk_id: input.clerkId,
      email: input.email,
      
      access_token: encrypt(input.accessToken),
      refresh_token: encrypt(input.refreshToken),
      expires_at: expiresAt,
      scopes: input.scopes,
    },
    { onConflict: 'clerk_id' }
  )
  if (error) throw error
}



async function updateAccessToken(
  clerkId: string,
  accessToken: string,
  expiresInSec: number,
  refreshToken?: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString()
  const patch: Record<string, string> = {
    access_token: encrypt(accessToken),
    expires_at: expiresAt,
  }
  
  
  if (refreshToken) patch.refresh_token = encrypt(refreshToken)
  const { error } = await supabase
    .from('gmail_oauth_tokens')
    .update(patch)
    .eq('clerk_id', clerkId)
  if (error) throw error
}






async function refreshAccessToken(row: GmailTokenRow): Promise<string> {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    refresh_token: row.refresh_token,
    grant_type: 'refresh_token',
  })
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    
    
    if (body.includes('invalid_grant')) {
      await deleteStoredTokens(row.clerk_id)
      throw new GmailAuthError('revoked', body)
    }
    throw new GmailAuthError('refresh_failed', `${res.status} ${body}`)
  }
  const data = (await res.json()) as {
    access_token: string
    expires_in: number
    refresh_token?: string
  }
  await updateAccessToken(row.clerk_id, data.access_token, data.expires_in, data.refresh_token)
  return data.access_token
}





export async function getValidAccessToken(clerkId: string): Promise<string> {
  const row = await getStoredTokens(clerkId)
  if (!row) throw new GmailAuthError('not_connected')
  const expiresAtMs = new Date(row.expires_at).getTime()
  if (expiresAtMs - Date.now() > 60_000) {
    return row.access_token
  }
  return await refreshAccessToken(row)
}







export async function gmailFetch(
  clerkId: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  let token = await getValidAccessToken(clerkId)
  const url = `${GMAIL_API_BASE}${path}`
  const doFetch = (t: string) =>
    fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${t}`,
      },
    })

  let res = await doFetch(token)
  if (res.status === 401) {
    
    const row = await getStoredTokens(clerkId)
    if (!row) throw new GmailAuthError('not_connected')
    token = await refreshAccessToken(row)
    res = await doFetch(token)
  }
  return res
}




export function buildAuthUrl(state: string): string {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.labels',
    'openid',
    'email',
    'profile',
  ].join(' ')
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',        // gets us a refresh_token
    prompt: 'consent',             // forces refresh_token every time (avoids "no refresh_token returned" gotcha)
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export interface ExchangedTokens {
  accessToken: string
  refreshToken: string
  expiresInSec: number
  scopes: string
  email: string
}

export async function exchangeCodeForTokens(code: string): Promise<ExchangedTokens> {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`
  const params = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Token exchange failed: ${res.status} ${body}`)
  }
  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope: string
    id_token?: string
  }
  if (!data.refresh_token) {
    
    
    throw new Error('Google did not return a refresh_token. Re-authorize with prompt=consent.')
  }

  
  const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  })
  if (!profileRes.ok) {
    throw new Error(`Failed to fetch Google profile: ${profileRes.status}`)
  }
  const profile = (await profileRes.json()) as { email: string }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresInSec: data.expires_in,
    scopes: data.scope,
    email: profile.email,
  }
}