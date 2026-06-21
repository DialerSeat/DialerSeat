import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { verifyWebhook } from '@/lib/verifyWebhook'

export async function POST(req: Request) {
  const bad = verifyWebhook(req)
  if (bad) return bad
  try {
    const formData = await req.formData()
    const callSid = formData.get('CallSid') as string
    const callStatus = formData.get('CallStatus') as string
    const duration = formData.get('CallDuration') as string

    console.log('Call status update:', { callSid, callStatus, duration })

    if (!callSid) {
      return NextResponse.json({ success: true })
    }

    // Map SignalWire call status to our disposition.
    // We only set disposition on terminal statuses; non-terminal updates leave it alone.
    let disposition: string | null = null
    if (callStatus === 'completed') disposition = 'completed'
    else if (callStatus === 'no-answer') disposition = 'no_answer'
    else if (callStatus === 'busy') disposition = 'busy'
    else if (callStatus === 'failed') disposition = 'failed'
    else if (callStatus === 'canceled') disposition = 'canceled'

    const updates: Record<string, any> = {
      duration: parseInt(duration || '0'),
    }
    if (disposition) updates.disposition = disposition

    await supabaseAdmin
      .from('calls')
      .update(updates)
      .eq('signalwire_call_id', callSid)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Status webhook error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}