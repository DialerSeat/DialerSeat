import { NextResponse } from 'next/server'
import { devStore } from '@/lib/developers/store'
import { getDevContext, jsonError } from '@/lib/developers/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * "Activate developer account". Free, one click. It makes the account and
 * nothing else: the first project, its survey and its keys come next, on /new.
 * Touches nothing on dialerseat.com: no subscription, no demo, no team.
 */
export async function POST() {
  const ctx = await getDevContext()
  if (!ctx) return jsonError(401, 'unauthorized', 'Sign in first.')
  if (!ctx.userId) return jsonError(409, 'account_not_ready', 'Your account is still being set up. Try again in a few seconds.')
  await devStore().createAccount(ctx.userId)
  return NextResponse.json({ activated: true, next: ctx.projects.length ? '/console' : '/new' })
}
