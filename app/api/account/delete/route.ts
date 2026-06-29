import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/requireUser'
import { deleteAccount } from '@/lib/deleteAccount'

// =============================================================================
// ACCOUNT DELETION ENDPOINT
// =============================================================================
// Identity is resolved ONLY from the Clerk session (requireUser) — a user can
// only ever delete THEIR OWN account; no client-supplied id is trusted.
//
// SAFETY MODEL (deletion is irreversible):
//   POST with no/false confirm  → DRY RUN: returns exact per-table counts of
//                                 what would be deleted, deletes NOTHING.
//   POST { confirm: "DELETE" }  → executes the deletion.
//
// Billing: deleteAccount() refuses if a live Stripe subscription exists; the
// caller must cancel in Stripe first (and the client should call the existing
// stripe/cancel flow) then pass allowActiveSubscription via ?force=1.
//
// NOTE: this hard-deletes DB rows. It does NOT delete the Clerk auth user — do
// that from the Clerk dashboard or Clerk backend API as a follow-up, since
// that's a separate system of record.
// =============================================================================

export async function POST(req: NextRequest) {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  let body: any = {}
  try { body = await req.json() } catch { body = {} }

  const confirmed = body?.confirm === 'DELETE'
  const allowActiveSubscription = body?.allowActiveSubscription === true

  const result = await deleteAccount(userId, {
    dryRun: !confirmed,
    allowActiveSubscription,
  })

  if (!result.ok && result.blocked) {
    return NextResponse.json(
      { success: false, error: result.blocked, counts: result.counts },
      { status: 409 }
    )
  }

  return NextResponse.json({
    success: true,
    dryRun: result.dryRun,
    message: result.dryRun
      ? 'Dry run — nothing was deleted. POST { confirm: "DELETE" } to proceed.'
      : 'Account data deleted.',
    counts: result.counts,
  })
}
