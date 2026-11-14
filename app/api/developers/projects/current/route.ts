import { NextResponse, type NextRequest } from 'next/server'
import { devStore } from '@/lib/developers/store'
import { getDevContext, jsonError } from '@/lib/developers/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Switch the console to another of your projects. */
export async function POST(req: NextRequest) {
  const ctx = await getDevContext()
  if (!ctx?.userId) return jsonError(401, 'unauthorized', 'Sign in first.')
  let body: { id?: unknown } = {}
  try { body = await req.json() } catch { return jsonError(400, 'invalid_json', 'Bad request.') }
  const target = ctx.projects.find(p => p.id === body.id)
  if (!target) return jsonError(404, 'not_found', 'You do not own a project with that id.')
  await devStore().setCurrentPlatform(ctx.userId, target.id)
  return NextResponse.json({ ok: true, project: { id: target.id, name: target.name } })
}
