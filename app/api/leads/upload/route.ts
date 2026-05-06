import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { requireActive } from '@/lib/subscription'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: Request) {
  try {
    // Active subscription required to upload leads
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

    // Ownership check: confirm the campaign belongs to the caller.
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
          user_id: userId, // Always use authenticated userId
          first_name,
          last_name,
          phone: String(phone).replace(/\D/g, ''),
          email: lead['email'] || lead['Email'] || lead['EMAIL'] || '',
          state: lead['state'] || lead['State'] || lead['STATE'] || '',
          status: 'uncalled',
          extra_data: lead,
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

    // FIX: increment total_leads instead of overwriting it.
    // Previous version called .update({ total_leads: leadsToInsert.length }), which
    // wiped out the running count on every upload (uploading 100 then 50 left
    // total_leads=50 instead of 150).
    //
    // Recalculating from a count() query is more reliable than incrementing,
    // because it self-corrects if a lead was deleted or insertion partially failed.
    const { count: actualCount } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign_id)

    await supabaseAdmin
      .from('campaigns')
      .update({ total_leads: actualCount ?? 0 })
      .eq('id', campaign_id)

    return NextResponse.json({
      success: true,
      count: leadsToInsert.length,
      total: actualCount,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}