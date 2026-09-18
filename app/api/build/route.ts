import { NextResponse } from 'next/server'
import { BUILD_SHA } from '@/lib/buildId'

/**
 * What commit is actually serving this request.
 *
 * Deliberately public and unauthenticated. Working out which build was live
 * has repeatedly cost more time than the bugs being chased: BUILD_SHA is only
 * reachable from the dialer's code-split bundle, which needs a login, so from
 * outside there was no way to tell a deployment carrying a fix from a
 * dashboard redeploy of an older one — both mint a fresh deployment id. The
 * only available signal was an agent's heartbeat, which requires that agent to
 * reload first, which is the very thing in question.
 *
 * A seven character commit hash of a private repository discloses nothing
 * usable; the diagnostic value is worth far more.
 *
 * Uncached on purpose — a cached answer here is worse than no answer.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

export function GET() {
  return NextResponse.json(
    { sha: BUILD_SHA, at: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
