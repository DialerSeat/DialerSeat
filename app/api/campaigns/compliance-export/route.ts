import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

/**
 * Generates a TSR-compliant audit log CSV for a campaign.
 * Restricted to the campaign owner.
 *
 * Query params:
 *   campaignId (required)
 *   startDate (ISO 8601, optional, default: 30 days ago)
 *   endDate (ISO 8601, optional, default: now)
 *   redactPhone (true/false, default: true — masks last 6 digits for safer export)
 *
 * Output: CSV with columns:
 *   call_id, timestamp, agent, lead_phone, amd_result, was_abandoned,
 *   disposition, duration_seconds, recording_url
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaignId')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const redactPhone = searchParams.get('redactPhone') !== 'false'

    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaignId required' }, { status: 400 })
    }

    // Verify ownership
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id, name')
      .eq('id', campaignId)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }
    if (campaign.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const startDate = startDateParam
      ? new Date(startDateParam).toISOString()
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = endDateParam
      ? new Date(endDateParam).toISOString()
      : new Date().toISOString()

    // Pull calls + recording URLs (recordings link via signalwire_call_id)
    const { data: calls, error } = await supabaseAdmin
      .from('calls')
      .select('id, signalwire_call_id, user_id, phone_number, amd_result, was_abandoned, disposition, duration, created_at')
      .eq('campaign_id', campaignId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true })

    if (error) throw error

    const callIds = (calls || []).map(c => c.signalwire_call_id).filter(Boolean) as string[]

    // Pull recordings for these calls (one to one relationship via signalwire_call_id)
    let recordingMap: Record<string, string> = {}
    if (callIds.length > 0) {
      const { data: recs } = await supabaseAdmin
        .from('recordings')
        .select('signalwire_call_id, recording_url')
        .in('signalwire_call_id', callIds)
      for (const r of recs || []) {
        if (r.signalwire_call_id && r.recording_url) {
          recordingMap[r.signalwire_call_id] = r.recording_url
        }
      }
    }

    // Resolve agent identities
    const userIds = Array.from(new Set((calls || []).map(c => c.user_id).filter(Boolean)))
    const userMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('clerk_id, email, first_name, last_name')
        .in('clerk_id', userIds)
      for (const u of users || []) {
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
        userMap[u.clerk_id] = name || u.email || u.clerk_id.slice(0, 12)
      }
    }

    // Generate CSV
    const header = [
      'call_id',
      'timestamp_utc',
      'agent',
      'lead_phone',
      'amd_result',
      'was_abandoned',
      'disposition',
      'duration_seconds',
      'recording_url',
    ].join(',')

    const rows = (calls || []).map(c => {
      const phone = redactPhone && c.phone_number
        ? maskPhone(c.phone_number)
        : (c.phone_number || '')
      const agent = c.user_id ? (userMap[c.user_id] || c.user_id.slice(0, 12)) : ''
      const recordingUrl = c.signalwire_call_id ? (recordingMap[c.signalwire_call_id] || '') : ''
      return [
        csvEscape(c.signalwire_call_id || c.id),
        csvEscape(c.created_at || ''),
        csvEscape(agent),
        csvEscape(phone),
        csvEscape(c.amd_result || ''),
        c.was_abandoned ? 'true' : 'false',
        csvEscape(c.disposition || ''),
        String(c.duration || 0),
        csvEscape(recordingUrl),
      ].join(',')
    })

    const csv = [header, ...rows].join('\n')

    const filename = `dialerseat-compliance-${campaign.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${startDate.slice(0, 10)}-to-${endDate.slice(0, 10)}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('[compliance-export] error:', error)
    return apiError(error, { route: 'campaigns/compliance-export' })
  }
}

function csvEscape(s: string): string {
  if (s == null) return ''
  const str = String(s)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function maskPhone(phone: string): string {
  // Keep area code + first 1 digit, mask rest. e.g. +18005551234 → +1800XXXXXXX
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return phone
  if (digits.length === 11 && digits[0] === '1') {
    return `+1${digits.slice(1, 4)}${'X'.repeat(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}${'X'.repeat(7)}`
  }
  return phone.slice(0, 4) + 'X'.repeat(Math.max(0, phone.length - 4))
}