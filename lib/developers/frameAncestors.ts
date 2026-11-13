// =============================================================================
// WHO MAY FRAME THE MINIPLAYER
// =============================================================================
// proxy.ts calls this for /embed/dialer and sends the answer as a
// Content-Security-Policy frame-ancestors header, so the browser itself refuses
// to show the dialer inside any page the platform did not list. The publishable
// key in the frame's address says which platform; it is public by design.
//
// Deliberately free of 'server-only' and the store module: proxy.ts imports
// it. Reads the same two backends the store does.
// =============================================================================

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

/** The platform's allowed origins for a publishable key, or null if the key is unknown or revoked. */
export async function allowedOriginsForKey(pk: string | null): Promise<string[] | null> {
  if (!pk || !/^pk_(test|live)_[0-9A-Za-z]{16,64}$/.test(pk)) return null
  try {
    if (process.env.DEV_PLATFORM_STORE === 'local' && process.env.NODE_ENV !== 'production') {
      const d = JSON.parse(await fs.readFile(path.join(process.cwd(), '.dev-platform-store.json'), 'utf8'))
      const key = (d.keys || []).find((k: { token: string | null; revoked_at: string | null }) => k.token === pk && !k.revoked_at)
      const p = key && (d.platforms || []).find((x: { id: string }) => x.id === key.platform_id)
      return p ? (p.allowed_origins as string[]) : null
    }
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    const { data: key } = await db.from('dev_api_keys').select('platform_id, revoked_at').eq('token', pk).maybeSingle()
    if (!key || key.revoked_at) return null
    const { data: p } = await db.from('dev_platforms').select('allowed_origins').eq('id', key.platform_id).maybeSingle()
    return p ? (p.allowed_origins as string[]) : null
  } catch {
    return null
  }
}

/** The header value. 'self' always, so the console can show its own test miniplayer. */
export function frameAncestorsHeader(origins: string[] | null): string {
  const list = (origins || []).filter(o => /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o))
  return `frame-ancestors 'self'${list.length ? ' ' + list.join(' ') : ''}`
}
