import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { requireActive } from '@/lib/subscription'
import { auth } from '@clerk/nextjs/server'

/**
 * Parses optional consent fields from a lead row. Returns the four columns
 * if they're present and parseable, all null otherwise.
 *
 * Accepted CSV header names (case-insensitive, punctuation-stripped):
 *   consent_date, consent date, consentdate
 *   consent_source, consent source
 *   consent_description, consent text, consent_text
 *   consent_proof_url, consent_proof, proof_url
 *
 * This is per the FCC's January 2025 one-to-one consent rule under TCPA.
 */
function parseConsent(row: Record<string, any>) {
  const lower: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && v !== undefined && String(v).trim()) {
      lower[k.toLowerCase().replace(/[^a-z]/g, '')] = String(v).trim()
    }
  }

  const dateRaw = lower['consentdate']
  const source = lower['consentsource']
  const description = lower['consentdescription'] || lower['consenttext']
  const proofUrl = lower['consentproofurl'] || lower['consentproof'] || lower['proofurl']

  let consentDate: string | null = null
  if (dateRaw) {
    const parsed = new Date(dateRaw)
    if (!isNaN(parsed.getTime())) consentDate = parsed.toISOString()
  }

  return {
    consent_date: consentDate,
    consent_source: source || null,
    consent_description: description || null,
    consent_proof_url: proofUrl || null,
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireActive()
    if (gate) return gate

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { campaign_id, leads } = body

    if (!campaign_id) {
      return NextResponse.json(
        { success: false, error: 'Missing campaign_id' },
        { status: 400 }
      )
    }

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No leads provided' },
        { status: 400 }
      )
    }

    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id, total_leads')
      .eq('id', campaign_id)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const leadsToInsert = leads.map((lead: any) => {
      let phone = ''
      let first_name = ''
      let last_name = ''

      if (typeof lead === 'object' && !Array.isArray(lead)) {
        const keys = Object.keys(lead)

        first_name = lead['first_name'] || lead['First Name'] ||
          lead['firstname'] || lead['FirstName'] ||
          lead['first'] || lead['First'] ||
          lead['name'] || lead['Name'] || lead[keys[0]] || ''

        last_name = lead['last_name'] || lead['Last Name'] ||
          lead['lastname'] || lead['LastName'] ||
          lead['last'] || lead['Last'] || lead[keys[1]] || ''

        phone = lead['phone'] || lead['Phone'] || lead['phone_number'] ||
          lead['Phone Number'] || lead['PHONE'] || lead['mobile'] ||
          lead['Mobile'] || lead['cell'] || lead['Cell'] ||
          Object.values(lead).find((v: any) =>
            typeof v === 'string' && v.replace(/\D/g, '').length >= 10
          ) as string || ''

        return {
          campaign_id,
          user_id: userId,
          first_name,
          last_name,
          phone: String(phone).replace(/\D/g, ''),
          email: lead['email'] || lead['Email'] || lead['EMAIL'] || '',
          state: lead['state'] || lead['State'] || lead['STATE'] || '',
          status: 'uncalled',
          extra_data: lead,
          ...parseConsent(lead),
        }
      }

      if (Array.isArray(lead)) {
        phone = lead.find((v: any) =>
          typeof v === 'string' && v.replace(/\D/g, '').length >= 10
        ) || ''

        return {
          campaign_id,
          user_id: userId,
          first_name: lead[0] || '',
          last_name: lead[1] || '',
          phone: String(phone).replace(/\D/g, ''),
          status: 'uncalled',
          extra_data: { raw: lead },
          // Array-format leads can't carry consent metadata cleanly,
          // so consent fields default to null
          consent_date: null,
          consent_source: null,
          consent_description: null,
          consent_proof_url: null,
        }
      }

      return null
    }).filter((lead: any) => lead && lead.phone && lead.phone.length >= 10)

    if (leadsToInsert.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid leads found. Make sure your file has phone numbers with at least 10 digits.'
      }, { status: 400 })
    }

    const { error: insertError } = await supabaseAdmin
      .from('leads')
      .insert(leadsToInsert)

    if (insertError) throw insertError

    const { count: actualCount } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign_id)

    await supabaseAdmin
      .from('campaigns')
      .update({ total_leads: actualCount ?? 0 })
      .eq('id', campaign_id)

    // Count how many leads in this batch actually carried consent metadata.
    // Useful for showing "uploaded 1,000 leads (823 with consent)" in the UI.
    const consentCount = leadsToInsert.filter((l: any) => l && l.consent_date).length

    return NextResponse.json({
      success: true,
      count: leadsToInsert.length,
      total: actualCount,
      withConsent: consentCount,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}