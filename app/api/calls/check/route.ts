import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sid = searchParams.get('sid')

    if (!sid) {
      return NextResponse.json({ success: false, error: 'No SID' }, { status: 400 })
    }

    // Verify the caller owns this call SID before reporting on it.
    const { data: room } = await supabase
      .from('call_rooms')
      .select('user_id')
      .or(`lead_call_sid.eq.${sid},agent_call_sid.eq.${sid}`)
      .maybeSingle()

    if (!room || room.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
    const projectId = process.env.SIGNALWIRE_PROJECT_ID
    const apiToken = process.env.SIGNALWIRE_API_TOKEN

    const response = await fetch(
      `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls/${sid}.json`,
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64'),
        },
      }
    )

    const data = await response.json()

    // Look up AMD result from our calls table. The amd-result webhook stores
    // it as disposition='NO_ANSWER_AMD' and also writes any machine_* result
    // there. The dialer needs to see this field to skip the disposition tab
    // when AMD hung up a voicemail.
    const { data: callRow } = await supabase
      .from('calls')
      .select('disposition, amd_result')
      .eq('signalwire_call_id', sid)
      .maybeSingle()

    // Build a normalized amd_result: prefer the explicit column if it exists,
    // otherwise infer from disposition. NO_ANSWER_AMD disposition means a
    // machine was detected, so report 'machine_end_other' as a sensible default.
    let amd_result: string | null = null
    if (callRow) {
      if ((callRow as any).amd_result) {
        amd_result = (callRow as any).amd_result
      } else if (callRow.disposition === 'NO_ANSWER_AMD') {
        amd_result = 'machine_end_other'
      }
    }

    return NextResponse.json({
      success: true,
      status: data.status,
      amd_result,
      data,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}