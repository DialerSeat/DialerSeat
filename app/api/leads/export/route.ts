import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/requireUser'

// SECURITY (was IDOR): this route exported up to 50,000 lead rows (PII) scoped
// ONLY by a client-supplied ?user_id, with no auth check. Any signed-in user
// could export anyone's leads. We now derive identity from the Clerk session
// and ignore the query param entirely.

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: NextRequest) {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get('campaign_id') || 'all'
  const disposition = searchParams.get('disposition') || 'all'
  const search = searchParams.get('search')?.trim() || ''

  let query = supabaseAdmin.from('leads').select('*').eq('user_id', userId)

  if (campaignId !== 'all') query = query.eq('campaign_id', campaignId)
  if (disposition !== 'all') {
    if (disposition === 'uncalled') query = query.is('disposition', null)
    else query = query.eq('disposition', disposition)
  }
  if (search) {
    const safe = search.replace(/[%,()]/g, '')
    query = query.or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,phone.ilike.%${safe}%`
    )
  }

  query = query.order('created_at', { ascending: false }).limit(50000)

  const { data, error } = await query
  if (error) return new Response(error.message, { status: 500 })

  const rows = data || []
  const headers = [
    'first_name',
    'last_name',
    'phone',
    'email',
    'state',
    'disposition',
    'dial_attempts',
    'last_called_at',
    'notes',
    'created_at',
  ]

  const csv = [
    headers.join(','),
    ...rows.map((r: any) =>
      headers.map(h => escapeCSV(r[h])).join(',')
    ),
  ].join('\n')

  const date = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="dialerseat-leads-${date}.csv"`,
    },
  })
}