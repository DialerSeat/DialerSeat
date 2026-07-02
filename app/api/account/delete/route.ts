import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/requireUser'
import { deleteAccount } from '@/lib/deleteAccount'

export async function POST(req: NextRequest) {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  let body: any = {}
  try { body = await req.json() } catch { body = {} }

  const confirmed = body?.confirm === 'DELETE'
  const allowActiveSubscription = body?.allowActiveSubscription === true

  const result = await deleteAccount(userId, {
    dryRun: !confirmed,
    allowActiveSubscription,
  })

  if (!result.ok && result.blocked) {
    return NextResponse.json(
      { success: false, error: result.blocked, counts: result.counts },
      { status: 409 }
    )
  }

  return NextResponse.json({
    success: true,
    dryRun: result.dryRun,
    message: result.dryRun
      ? 'Dry run — nothing was deleted. POST { confirm: "DELETE" } to proceed.'
      : 'Account data deleted.',
    counts: result.counts,
  })
}
