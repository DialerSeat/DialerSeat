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
    // call_rooms tracks both lead_call_sid and agent_call_sid; either one matches.
    const { data: room } = await supabase
      .from('call_rooms')
      .select('user_id')
      .or(`lead_call_sid.eq.${sid},agent_call_sid.eq.${sid}`)
      .maybeSingle()

    if (!room || room.user_id !== userId) {
      // Don't leak whether the SID exists — return same shape as not-found
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
    return NextResponse.json({ success: true, status: data.status, data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}