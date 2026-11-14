import { NextResponse, type NextRequest } from 'next/server'
import { devStore } from '@/lib/developers/store'
import { generateKey } from '@/lib/developers/keys'
import { getDevContext, jsonError, slugify } from '@/lib/developers/server'
import { cleanProfile, modesFromProfile } from '@/lib/developers/survey'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_PROJECTS = 20

/**
 * Create a project from the /new survey: the project, its first test keys,
 * and it becomes the current project. The secret key is returned this once;
 * the setup page shows it and it can never be read again.
 */
export async function POST(req: NextRequest) {
  const ctx = await getDevContext()
  if (!ctx) return jsonError(401, 'unauthorized', 'Sign in first.')
  if (!ctx.userId) return jsonError(409, 'account_not_ready', 'Your account is still being set up. Try again in a few seconds.')
  if (!ctx.account) return jsonError(403, 'not_activated', 'Activate your developer account first.')
  if (ctx.projects.length >= MAX_PROJECTS) return jsonError(409, 'too_many_projects', `You have ${MAX_PROJECTS} projects. Email sales@dialerseat.com for more.`)

  let body: { name?: unknown; website?: unknown; answers?: unknown } = {}
  try { body = await req.json() } catch { return jsonError(400, 'invalid_json', 'Bad request.') }
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
  if (!name) return jsonError(400, 'name_required', 'Give your project a name. You can change it later.')
  const website = typeof body.website === 'string' && body.website.trim() ? body.website.trim().slice(0, 200) : null
  const { profile, approach } = cleanProfile(body.answers)

  const store = devStore()
  const base = slugify(name)
  let slug = base
  for (let i = 2; await store.slugTaken(slug); i++) slug = `${base}-${i}`

  const platform = await store.createPlatform({ owner_user_id: ctx.userId, name, slug, website, profile, integration_approach: approach })
  const modes = modesFromProfile(profile)
  if (modes.length < 4) {
    await store.updatePlatform(platform.id, { allowed_dial_modes: modes, default_dial_mode: modes.includes('power') ? 'power' : modes[0] })
  }
  const sk = generateKey('secret', 'test')
  const pk = generateKey('publishable', 'test')
  await store.insertKey({ platform_id: platform.id, kind: 'secret', env: 'test', name: 'Default test key', key_hash: sk.hash, token: null, prefix: sk.prefix, last4: sk.last4, scopes: ['*'], created_by: ctx.userId })
  await store.insertKey({ platform_id: platform.id, kind: 'publishable', env: 'test', name: 'Default publishable key', key_hash: null, token: pk.key, prefix: pk.prefix, last4: pk.last4, scopes: ['embed'], created_by: ctx.userId })
  await store.setCurrentPlatform(ctx.userId, platform.id)

  return NextResponse.json({ project: { id: platform.id, name: platform.name }, secret_key: sk.key, publishable_key: pk.key })
}
