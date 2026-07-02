import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/apiError'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('API HIT - body received:', body)

    const { clerk_id, email, first_name, last_name, phone, company, username } = body

    if (!clerk_id) {
      return NextResponse.json({ success: false, error: 'No clerk_id provided' }, { status: 400 })
    }

    const normalizedUsername =
      typeof username === 'string' && username.trim().length > 0 ? username.trim() : null

    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        clerk_id,
        email,
        first_name,
        last_name,
        phone,
        company,
        username: normalizedUsername,
      })

    if (insertError) {
      console.log('INSERT ERROR:', insertError)

      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          email,
          first_name,
          last_name,
          phone,
          company,
          username: normalizedUsername,
        })
        .eq('clerk_id', clerk_id)

      if (updateError) {
        console.log('UPDATE ERROR:', updateError)
        return apiError(updateError, { route: 'users/create' })
      }
    }

    console.log('SUCCESS - user saved')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.log('CATCH ERROR:', error)
    return apiError(error, { route: 'users/create' })
  }
}