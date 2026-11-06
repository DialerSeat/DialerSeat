// The demo's read API. proxy.ts rewrites a never-paid account's GETs here; see
// lib/demo/serve.ts. It only ever returns generated placeholder data, and it
// never reads or writes a table. The proxy names the account (x-demo-owner) so the
// demo rows carry its id; nothing beyond that depends on who is asking.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { demoAnswer } from '@/lib/demo/serve'

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const owner = req.headers.get('x-demo-owner') || await auth().then(a => a.userId).catch(() => null) || 'demo_owner'
  const body = demoAnswer(path.join('/'), req.nextUrl.searchParams, owner)
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
