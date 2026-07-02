import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { count: totalLeads } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    const { count: withConsent } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('consent_date', 'is', null)

    return NextResponse.json({
      success: true,
      totalLeads: totalLeads ?? 0,
      withConsent: withConsent ?? 0,
    })
  } catch (error: any) {
    return apiError(error, { route: 'leads/consent-summary' })
  }
}