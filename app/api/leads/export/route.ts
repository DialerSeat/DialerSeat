import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const campaignId = searchParams.get('campaign_id') || 'all'
  const disposition = searchParams.get('disposition') || 'all'
  const search = searchParams.get('search')?.trim() || ''

  if (!userId) {
    return new Response('user_id required', { status: 400 })
  }

  let query = supabase.from('leads').select('*').eq('user_id', userId)

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