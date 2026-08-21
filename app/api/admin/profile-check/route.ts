import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────
// WHAT DOES CLERK ACTUALLY HOLD?
//
// Built because a name kept "not updating" through three separate sync paths
// — the user.updated webhook, a refresh on sign-in, and a bulk refresh when a
// roster is read — and all three left the row unchanged. Two of those were
// verified correct against the installed SDK, which makes the interesting
// question no longer "why is the sync broken" but "are the two values even
// different".
//
// Nothing here syncs anything. It reads both sides and prints them, so the
// answer takes one request instead of another round of guessing:
//
//   different  -> a sync path is genuinely failing, and `clerkError` will
//                 usually say why
//   identical  -> Clerk was never told about the change, and the fix is in
//                 the Clerk dashboard rather than in this codebase
//
// Admin only. It exposes one person's name and email to somebody who can
// already read every user in the admin app.
// ─────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const clerkId = req.nextUrl.searchParams.get('clerk_id') || ''
  const email = req.nextUrl.searchParams.get('email') || ''

  if (!clerkId && !email) {
    return NextResponse.json(
      { success: false, error: 'Pass clerk_id or email' },
      { status: 400 }
    )
  }

  let query = supabaseAdmin
    .from('users')
    .select('clerk_id, first_name, last_name, username, email')
  query = clerkId ? query.eq('clerk_id', clerkId) : query.eq('email', email)

  const { data: row } = await query.maybeSingle()
  if (!row) {
    return NextResponse.json({ success: false, error: 'No users row for that' }, { status: 404 })
  }

  let clerk: any = null
  let clerkError: string | null = null
  try {
    const { clerkClient } = await import('@clerk/nextjs/server')
    const client = await clerkClient()
    const u = await client.users.getUser(row.clerk_id)
    clerk = {
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      email:
        u.emailAddresses?.find(e => e.id === u.primaryEmailAddressId)?.emailAddress ||
        u.emailAddresses?.[0]?.emailAddress ||
        null,
      updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : null,
    }
  } catch (err: any) {
    clerkError = err?.message || String(err)
  }

  const differs = clerk
    ? {
        firstName: row.first_name !== clerk.firstName,
        lastName: row.last_name !== clerk.lastName,
        username: row.username !== clerk.username,
        email: clerk.email !== null && row.email !== clerk.email,
      }
    : null

  return NextResponse.json({
    success: true,
    ours: {
      firstName: row.first_name,
      lastName: row.last_name,
      username: row.username,
      email: row.email,
    },
    clerk,
    clerkError,
    differs,
    verdict: clerkError
      ? 'Could not reach Clerk — that error is why the syncs are silent.'
      : differs && Object.values(differs).some(Boolean)
        ? 'They differ, so a sync path is failing rather than missing.'
        : 'Identical. Clerk holds the same name we do, so nothing changed it there.',
  })
}
