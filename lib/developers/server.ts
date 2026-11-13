// Server helpers shared by the console pages and the console API.

import 'server-only'
import { auth, currentUser } from '@clerk/nextjs/server'
import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { devStore, type Platform } from './store'
import { localTestUser } from './localAuth'

export interface DevContext {
  clerkUserId: string
  /** users.id, or null if the account's users row has not been written yet. */
  userId: string | null
  platform: Platform | null
}

/** Who is signed in and whether they have activated a developer account. Null if signed out. */
export async function getDevContext(): Promise<DevContext | null> {
  const clerkUserId = localTestUser() || (await auth()).userId
  if (!clerkUserId) return null
  const store = devStore()
  const userId = await store.resolveUserId(clerkUserId)
  const platform = userId ? await store.getPlatformByOwner(userId) : null
  return { clerkUserId, userId, platform }
}

/** '' on dev.dialerseat.com, '/developers' anywhere else. Set by proxy.ts. */
export async function devBase(): Promise<string> {
  const h = await headers()
  const v = h.get('x-dev-base')
  return v === null ? '/developers' : v
}

/** For console pages: the layout has already checked, so this only narrows the type. */
export async function consoleContext(): Promise<DevContext & { platform: Platform }> {
  const ctx = await getDevContext()
  if (!ctx?.platform) {
    const { redirect } = await import('next/navigation')
    redirect(`${await devBase()}/welcome`)
  }
  return ctx as DevContext & { platform: Platform }
}

/** The console's Test / Live switch (a cookie set by the top bar). Test unless chosen. */
export async function consoleEnv(): Promise<'test' | 'live'> {
  return (await cookies()).get('dv-env')?.value === 'live' ? 'live' : 'test'
}

export async function signedInEmail(): Promise<string | null> {
  if (localTestUser()) return 'local-test@dialerseat.invalid'
  const u = await currentUser()
  return u?.primaryEmailAddress?.emailAddress || null
}

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status })
}

/** For console API routes: the caller's platform, or the response to send instead. */
export async function requirePlatform(): Promise<{ ctx: DevContext & { platform: Platform } } | { res: NextResponse }> {
  const ctx = await getDevContext()
  if (!ctx) return { res: jsonError(401, 'unauthorized', 'Sign in to use the console.') }
  if (!ctx.platform) return { res: jsonError(403, 'not_activated', 'Activate your developer account first.') }
  return { ctx: ctx as DevContext & { platform: Platform } }
}

export function slugify(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'platform'
}

/** Normalise an origin a developer typed: "app.acme.com/" → "https://app.acme.com". Null if it is not one. */
export function normaliseOrigin(raw: string): string | null {
  let s = raw.trim()
  if (!s) return null
  // A bare host is https, except localhost, which is http while building.
  if (!/^https?:\/\//i.test(s)) s = (/^(localhost|127\.0\.0\.1)(:|$)/i.test(s) ? 'http://' : 'https://') + s
  try {
    const u = new URL(s)
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null
    return `${u.protocol}//${u.host}`.toLowerCase()
  } catch {
    return null
  }
}
