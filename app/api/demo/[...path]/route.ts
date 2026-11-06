// The demo's read API. proxy.ts rewrites a never-paid account's GETs here; see
// lib/demo/serve.ts. It only ever returns generated placeholder data, and it
// never reads or writes a table.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { demoAnswer } from '@/lib/demo/serve'

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const { path } = await ctx.params
  const body = demoAnswer(path.join('/'), req.nextUrl.searchParams, userId)
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
