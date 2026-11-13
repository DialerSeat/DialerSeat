import { NextResponse, type NextRequest } from 'next/server'
import { devStore } from '@/lib/developers/store'
import { OUTCOME_CLASSES } from '@/lib/developers/catalog'
import { jsonError, requirePlatform } from '@/lib/developers/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const OUTCOMES = OUTCOME_CLASSES.map(o => o.id) as string[]

/** Add or update a disposition by its code. */
export async function POST(req: NextRequest) {
  const r = await requirePlatform(); if ('res' in r) return r.res
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return jsonError(400, 'invalid_json', 'The body is not valid JSON.') }
  const code = typeof b.code === 'string' ? b.code.trim().slice(0, 60) : ''
  const label = typeof b.label === 'string' ? b.label.trim().slice(0, 80) : ''
  const outcome = String(b.outcome || '')
  if (!code || !/^[A-Za-z0-9_.-]+$/.test(code)) return jsonError(400, 'invalid', 'The code can use letters, numbers, _ . and -')
  if (!label) return jsonError(400, 'invalid', 'Give it the label agents will see.')
  if (!OUTCOMES.includes(outcome)) return jsonError(400, 'invalid', 'Pick what kind of outcome it is.')
  const store = devStore()
  const existing = await store.listDispositions(r.ctx.platform.id)
  if (existing.length >= 60 && !existing.some(d => d.code === code)) return jsonError(400, 'too_many', 'A platform can have 60 dispositions.')
  const sort = typeof b.sort === 'number' ? Math.round(b.sort) : (existing.find(d => d.code === code)?.sort ?? existing.length)
  const d = await store.upsertDisposition({ platform_id: r.ctx.platform.id, code, label, outcome, sort })
  return NextResponse.json({ disposition: d })
}

export async function DELETE(req: NextRequest) {
  const r = await requirePlatform(); if ('res' in r) return r.res
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return jsonError(400, 'invalid', 'Which disposition?')
  await devStore().deleteDisposition(r.ctx.platform.id, id)
  return NextResponse.json({ deleted: true })
}
