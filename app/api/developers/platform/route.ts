import { NextResponse, type NextRequest } from 'next/server'
import { devStore, type PlatformPatch } from '@/lib/developers/store'
import { DIAL_MODES, type DialMode } from '@/lib/developers/catalog'
import { jsonError, normaliseOrigin, requirePlatform } from '@/lib/developers/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MODES = DIAL_MODES.map(m => m.id)

/**
 * Every console setting that lives on the platform row. Only the fields sent
 * are changed, and each one is checked here; rates and tier are set by sales
 * and are not writable from the console.
 */
export async function PATCH(req: NextRequest) {
  const r = await requirePlatform(); if ('res' in r) return r.res
  const { platform } = r.ctx
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return jsonError(400, 'invalid_json', 'The body is not valid JSON.') }

  const patch: PlatformPatch = {}
  if ('name' in b) {
    const n = typeof b.name === 'string' ? b.name.trim().slice(0, 80) : ''
    if (!n) return jsonError(400, 'name_required', 'The platform needs a name.')
    patch.name = n
  }
  if ('website' in b) patch.website = typeof b.website === 'string' && b.website.trim() ? b.website.trim().slice(0, 200) : null
  if ('billing_model' in b) {
    if (b.billing_model !== 'user' && b.billing_model !== 'platform' && b.billing_model !== 'mixed') return jsonError(400, 'invalid', 'Billing must be user, platform or mixed.')
    patch.billing_model = b.billing_model
  }
  if ('allowed_dial_modes' in b) {
    const list = Array.isArray(b.allowed_dial_modes) ? b.allowed_dial_modes.filter((m): m is DialMode => MODES.includes(m as DialMode)) : []
    if (list.length === 0) return jsonError(400, 'invalid', 'Allow at least one dial mode.')
    patch.allowed_dial_modes = MODES.filter(m => list.includes(m))
  }
  if ('default_dial_mode' in b) {
    if (!MODES.includes(b.default_dial_mode as DialMode)) return jsonError(400, 'invalid', 'Unknown dial mode.')
    patch.default_dial_mode = b.default_dial_mode as DialMode
  }
  const allowed = patch.allowed_dial_modes || platform.allowed_dial_modes
  const def = patch.default_dial_mode || platform.default_dial_mode
  if (!allowed.includes(def)) return jsonError(400, 'invalid', 'The default dial mode has to be one of the allowed modes.')
  if ('seats_may_choose_mode' in b) patch.seats_may_choose_mode = b.seats_may_choose_mode === true
  if ('allowed_origins' in b) {
    if (!Array.isArray(b.allowed_origins)) return jsonError(400, 'invalid', 'allowed_origins must be a list.')
    const out: string[] = []
    for (const raw of b.allowed_origins) {
      const o = normaliseOrigin(String(raw))
      if (!o) return jsonError(400, 'invalid_origin', `"${String(raw)}" is not a web address.`)
      if (!out.includes(o)) out.push(o)
    }
    if (out.length > 25) return jsonError(400, 'invalid', 'At most 25 origins.')
    patch.allowed_origins = out
  }

  if ('integration_approach' in b) {
    if (!['script', 'iframe', 'react', 'headless', 'hosted'].includes(String(b.integration_approach))) return jsonError(400, 'invalid', 'Unknown integration approach.')
    patch.integration_approach = b.integration_approach as PlatformPatch['integration_approach']
  }
  if ('setup_completed' in b) patch.setup_completed_at = b.setup_completed === true ? new Date().toISOString() : null
  const updated = await devStore().updatePlatform(platform.id, patch)
  return NextResponse.json({ platform: updated })
}
