import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { campaign_id, user_id, leads } = body

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
          user_id,
          first_name,
          last_name,
          phone: String(phone).replace(/\D/g, ''),
          email: lead['email'] || lead['Email'] || lead['EMAIL'] || '',
          state: lead['state'] || lead['State'] || lead['STATE'] || '',
          status: 'uncalled',
          extra_data: lead, // save entire row
        }
      }

      if (Array.isArray(lead)) {
        phone = lead.find((v: any) =>
          typeof v === 'string' && v.replace(/\D/g, '').length >= 10
        ) || ''

        return {
          campaign_id,
          user_id,
          first_name: lead[0] || '',
          last_name: lead[1] || '',
          phone: String(phone).replace(/\D/g, ''),
          status: 'uncalled',
          extra_data: { raw: lead }, // save raw array as object
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

    const { error } = await supabaseAdmin
      .from('leads')
      .insert(leadsToInsert)

    if (error) throw error

    await supabaseAdmin
      .from('campaigns')
      .update({ total_leads: leadsToInsert.length })
      .eq('id', campaign_id)

    return NextResponse.json({ success: true, count: leadsToInsert.length })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}