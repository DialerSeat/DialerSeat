import { NextResponse } from 'next/server'
import { devStore } from '@/lib/developers/store'
import { jsonError, requirePlatform } from '@/lib/developers/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Revoke. Immediate, and cannot be undone: the key row stays so a leak can be traced. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await requirePlatform(); if ('res' in r) return r.res
  const { id } = await params
  const key = await devStore().revokeKey(r.ctx.platform.id, id)
  if (!key) return jsonError(404, 'not_found', 'No such key on your platform.')
  return NextResponse.json({ id: key.id, revoked_at: key.revoked_at })
}
