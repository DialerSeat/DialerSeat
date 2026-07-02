import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/requireUser'

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
