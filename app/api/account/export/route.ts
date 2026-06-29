import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/requireUser'

// =============================================================================
// FULL-ACCOUNT DATA EXPORT (data portability)
// =============================================================================
// Returns EVERYTHING the authenticated user owns as a single JSON document.
// This is the machine-readable "give me all my data" export for legal data-
// portability (CCPA/GDPR-style) and user self-service.
//
// SECURITY: identity is resolved ONLY from the Clerk session via requireUser().
// No client-supplied id is ever trusted (see lib/requireUser — this is the same
// pattern that fixed the prior export IDOR). Every query is scoped to the
// caller's own Clerk id.
//
// READ-ONLY: this route performs SELECTs only. It cannot modify or delete
// anything. Safe to call any time.
//
// Tables are keyed by Clerk id (text user_id / clerk_id / owner_id). Internal-
// uuid-keyed operational tables (agent_sessions, agent_predictive_prefs) are
// transient runtime state, not user content, and are intentionally excluded.
// =============================================================================

// Each entry: [resultKey, tableName, userColumn]. userColumn is how that table
// references the Clerk user id.
const USER_TABLES: Array<[string, string, string]> = [
  ['profile', 'users', 'clerk_id'],
  ['subscriptions', 'subscriptions', 'user_id'],
  ['campaigns', 'campaigns', 'user_id'],
  ['leads', 'leads', 'user_id'],
  ['lead_notes', 'lead_notes', 'user_id'],
  ['calls', 'calls', 'user_id'],
  ['dial_attempts', 'dial_attempts', 'user_id'],
  ['scripts', 'scripts', 'user_id'],
  ['custom_themes', 'custom_themes', 'user_id'],
  ['teams_owned', 'teams', 'owner_id'],
  ['team_memberships', 'team_members', 'user_id'],
  ['support_submissions', 'support_submissions', 'clerk_id'],
  ['desktop_prefs', 'desktop_prefs', 'clerk_id'],
  ['desktop_icons', 'desktop_icons', 'clerk_id'],
  ['desktop_windows', 'desktop_windows', 'clerk_id'],
]

export async function GET() {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  const exportData: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: userId,
  }
  const warnings: string[] = []

  for (const [key, table, col] of USER_TABLES) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .eq(col, userId)
    if (error) {
      // Never fail the whole export because one table errored — record it and
      // continue, so the user still gets everything else.
      warnings.push(`${table}: ${error.message}`)
      exportData[key] = []
      continue
    }
    exportData[key] = data ?? []
  }

  if (warnings.length) exportData._warnings = warnings

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="dialerseat-account-export-${date}.json"`,
    },
  })
}
