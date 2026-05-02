import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('API HIT - body received:', body)

    const { clerk_id, email, first_name, last_name, phone, company } = body

    if (!clerk_id) {
      return NextResponse.json({ success: false, error: 'No clerk_id provided' }, { status: 400 })
    }

    // First try to insert
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        clerk_id,
        email,
        first_name,
        last_name,
        phone,
        company,
      })

    if (insertError) {
      console.log('INSERT ERROR:', insertError)
      
      // If duplicate, try update instead
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          email,
          first_name,
          last_name,
          phone,
          company,
        })
        .eq('clerk_id', clerk_id)

      if (updateError) {
        console.log('UPDATE ERROR:', updateError)
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
      }
    }

    console.log('SUCCESS - user saved')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.log('CATCH ERROR:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}