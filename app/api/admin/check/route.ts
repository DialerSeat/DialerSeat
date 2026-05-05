import { NextResponse } from 'next/server'
import { checkIsAdmin } from '@/lib/admin'

export async function GET() {
  const { isAdmin } = await checkIsAdmin()
  return NextResponse.json({ isAdmin })
}