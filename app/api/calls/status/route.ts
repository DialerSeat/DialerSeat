import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const callSid = formData.get('CallSid') as string
    const callStatus = formData.get('CallStatus') as string
    const duration = formData.get('CallDuration') as string

    console.log('Call status update:', { callSid, callStatus, duration })

    // Update call record in Supabase
    if (callSid) {
      await supabaseAdmin
        .from('calls')
        .update({
          duration: parseInt(duration || '0'),
        })
        .eq('signalwire_call_id', callSid)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}