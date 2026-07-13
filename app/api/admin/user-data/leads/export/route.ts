import { NextRequest } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const supabase = getServiceClient('admin/user-data/leads-export')
  const campaignId = req.nextUrl.searchParams.get('campaign_id')
  if (!campaignId) {
    return new Response('Missing campaign_id', { status: 400 })
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('id', campaignId)
    .maybeSingle()

  if (!campaign) {
    return new Response('Campaign not found', { status: 404 })
  }

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(50000)

  if (error) {
    return new Response(error.message, { status: 500 })
  }

  const rows = data || []
  const headers = [
    'first_name', 'last_name', 'phone', 'email', 'address', 'city', 'state', 'zip',
    'disposition', 'dial_attempts', 'last_called_at', 'notes',
    'consent_date', 'consent_source', 'created_at',
  ]

  const csv = [
    headers.join(','),
    ...rows.map((r: any) => headers.map(h => escapeCSV(r[h])).join(',')),
  ].join('\n')

  const safeName = (campaign.name || 'leads').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60)
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName || 'leads'}-${date}.csv"`,
    },
  })
}
