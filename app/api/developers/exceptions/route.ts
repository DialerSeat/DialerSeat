import { NextResponse, type NextRequest } from 'next/server'
import { devStore } from '@/lib/developers/store'
import { DIAL_MODES, type DialMode } from '@/lib/developers/catalog'
import { jsonError, requirePlatform } from '@/lib/developers/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MODES = DIAL_MODES.map(m => m.id)

/** Add or replace the dial-mode exception for one seat or one campaign. */
export async function POST(req: NextRequest) {
  const r = await requirePlatform(); if ('res' in r) return r.res
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return jsonError(400, 'invalid_json', 'The body is not valid JSON.') }
  const scope = b.scope === 'campaign' ? 'campaign' : b.scope === 'seat' ? 'seat' : null
  if (!scope) return jsonError(400, 'invalid', 'Choose a seat or a campaign.')
  const external = typeof b.external_id === 'string' ? b.external_id.trim().slice(0, 120) : ''
  if (!external) return jsonError(400, 'invalid', `Enter the ${scope}'s id from your platform.`)
  const dial = b.dial_mode ? String(b.dial_mode) : null
  if (dial && !MODES.includes(dial as DialMode)) return jsonError(400, 'invalid', 'Unknown dial mode.')
  const allowed = Array.isArray(b.allowed_modes) ? b.allowed_modes.map(String).filter((m): m is DialMode => MODES.includes(m as DialMode)) : null
  if (!dial && (!allowed || allowed.length === 0)) return jsonError(400, 'invalid', 'Set a dial mode or the modes it may use.')
  if (dial && allowed && allowed.length && !allowed.includes(dial as DialMode)) return jsonError(400, 'invalid', 'The dial mode has to be one of the modes it may use.')

  const ex = await devStore().upsertException({
    platform_id: r.ctx.platform.id, scope, external_id: external,
    dial_mode: (dial as DialMode) || null, allowed_modes: allowed && allowed.length ? allowed : null,
    note: typeof b.note === 'string' ? b.note.trim().slice(0, 200) || null : null,
  })
  return NextResponse.json({ exception: ex })
}

export async function DELETE(req: NextRequest) {
  const r = await requirePlatform(); if ('res' in r) return r.res
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return jsonError(400, 'invalid', 'Which exception?')
  await devStore().deleteException(r.ctx.platform.id, id)
  return NextResponse.json({ deleted: true })
}
