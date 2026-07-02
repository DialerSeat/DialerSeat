import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'





























export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const sipUsername = process.env.SIGNALWIRE_SIP_USERNAME
  const sipPassword = process.env.SIGNALWIRE_SIP_PASSWORD
  const sipDomain = process.env.SIGNALWIRE_SIP_DOMAIN

  if (!sipUsername || !sipPassword || !sipDomain) {
    return NextResponse.json(
      { success: false, error: 'SIP credentials not configured on server' },
      { status: 500 }
    )
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [
    { urls: ['stun:stun.signalwire.com:3478', 'stun:stun.l.google.com:19302'] },
  ]

  const turnUrls = process.env.SIGNALWIRE_TURN_URLS
  const turnUsername = process.env.SIGNALWIRE_TURN_USERNAME
  const turnCredential = process.env.SIGNALWIRE_TURN_CREDENTIAL
  if (turnUrls && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrls.split(',').map(u => u.trim()).filter(Boolean),
      username: turnUsername,
      credential: turnCredential,
    })
  }

  
  return NextResponse.json(
    { success: true, sipUsername, sipPassword, sipDomain, iceServers },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' } }
  )
}