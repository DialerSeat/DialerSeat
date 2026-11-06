// The demo's read API. proxy.ts rewrites a never-paid account's GETs here; see
// lib/demo/serve.ts. It only ever returns generated placeholder data, and it
// never reads or writes a table, so nothing here depends on who is asking beyond
// filling in their id as the owner of the demo rows.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { demoAnswer } from '@/lib/demo/serve'

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const userId = await auth().then(a => a.userId).catch(() => null)
  const { path } = await ctx.params
  const body = demoAnswer(path.join('/'), req.nextUrl.searchParams, userId || 'demo_owner')
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
