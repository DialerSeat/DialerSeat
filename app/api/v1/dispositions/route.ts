import type { NextRequest } from 'next/server'
import { withV1, v1Json, v1Error, readJson, str } from '@/lib/developers/v1'
import { OUTCOME_CLASSES } from '@/lib/developers/catalog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const OUTCOMES = OUTCOME_CLASSES.map(o => o.id) as string[]

export async function GET(req: NextRequest) {
  return withV1(req, async ({ platform, store }) => {
    const rows = await store.listDispositions(platform.id)
    return v1Json({ object: 'list', data: rows.map(d => ({ object: 'disposition', id: d.id, code: d.code, label: d.label, outcome: d.outcome, sort: d.sort })) })
  })
}

/** Create or update a disposition by its code. */
export async function POST(req: NextRequest) {
  return withV1(req, async ({ platform, store }) => {
    const r = await readJson(req); if ('res' in r) return r.res
    const code = str(r.body.code, 60)
    const label = str(r.body.label, 80)
    const outcome = str(r.body.outcome, 30)
    if (!code || !/^[A-Za-z0-9_.-]+$/.test(code)) return v1Error('invalid_request', 'code is required: letters, numbers, _ . or -', 'code')
    if (!label) return v1Error('invalid_request', 'label is required: what agents see.', 'label')
    if (!outcome || !OUTCOMES.includes(outcome)) return v1Error('invalid_request', `outcome must be one of: ${OUTCOMES.join(', ')}`, 'outcome')
    const sort = typeof r.body.sort === 'number' ? Math.round(r.body.sort) : 0
    const d = await store.upsertDisposition({ platform_id: platform.id, code, label, outcome, sort })
    return v1Json({ object: 'disposition', id: d.id, code: d.code, label: d.label, outcome: d.outcome, sort: d.sort })
  })
}
