import { NextResponse, type NextRequest } from 'next/server'
import { devStore } from '@/lib/developers/store'
import { jsonError, requirePlatform } from '@/lib/developers/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type P = { params: Promise<{ id: string }> }

/** Pause or resume an endpoint. */
export async function PATCH(req: NextRequest, { params }: P) {
  const r = await requirePlatform(); if ('res' in r) return r.res
  const { id } = await params
  let b: { disabled?: unknown } = {}
  try { b = await req.json() } catch { /* */ }
  const ep = await devStore().setWebhookDisabled(r.ctx.platform.id, id, b.disabled === true)
  if (!ep) return jsonError(404, 'not_found', 'No such endpoint.')
  return NextResponse.json({ endpoint: ep })
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const r = await requirePlatform(); if ('res' in r) return r.res
  const { id } = await params
  await devStore().deleteWebhook(r.ctx.platform.id, id)
  return NextResponse.json({ deleted: true })
}
