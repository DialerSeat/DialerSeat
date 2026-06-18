import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('API HIT - body received:', body)

    // username mirrors the Clerk username (Clerk is the source of truth). The
    // caller passes it in the body alongside the other Clerk fields. Stored on
    // public.users for in-app display/sorting/joins; nullable + unique
    // (case-insensitive) at the DB level.
    const { clerk_id, email, first_name, last_name, phone, company, username } = body

    if (!clerk_id) {
      return NextResponse.json({ success: false, error: 'No clerk_id provided' }, { status: 400 })
    }

    // Normalize username: trim, treat empty as null so the unique index ignores it.
    const normalizedUsername =
      typeof username === 'string' && username.trim().length > 0 ? username.trim() : null

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
        username: normalizedUsername,
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
          username: normalizedUsername,
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