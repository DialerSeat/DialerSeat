



















import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAvailableTenantsForUser } from '@/lib/tenant'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const options = await getAvailableTenantsForUser(userId)
  return NextResponse.json(options)
}