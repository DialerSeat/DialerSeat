// Is a brand-new subdomain answering yet? Its certificate takes a little while
// after it is created, and until then the address is a dead link. Asked from the
// server so the check sees the real answer, including a redirect back to the main
// site while the brand is not yet recognised. Only ever asks our own domain.
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ ready: false }, { status: 401 })
  const slug = (req.nextUrl.searchParams.get('slug') || '').toLowerCase().trim()
  if (!SLUG_RE.test(slug)) return NextResponse.json({ ready: false })
  try {
    const res = await fetch(`https://${slug}.${ROOT_DOMAIN}/sign-in`, {
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    })
    return NextResponse.json({ ready: res.status === 200 })
  } catch {
    // No certificate yet, or the name has not reached DNS: both mean keep waiting.
    return NextResponse.json({ ready: false })
  }
}
