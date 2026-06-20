// =============================================================================
// app/[indexnowKey]/route.ts — IndexNow key verification file
// =============================================================================
// IndexNow verifies you own the domain by fetching a key file at the root:
//     https://dialerseat.com/<key>.txt   →  must return exactly <key>
//
// Rather than commit a static <key>.txt (which would leak the key in your repo),
// this dynamic route serves the key ONLY when the requested path matches the
// INDEXNOW_KEY env var. Any other path 404s. So the file "exists" at exactly
// one URL — the one IndexNow asks for — and nowhere else.
//
// IMPORTANT — placement & conflicts:
//   Put this at app/[indexnowKey]/route.ts. Because it's a catch-all-ish dynamic
//   segment at the ROOT, it could shadow other root paths. Next resolves STATIC
//   and more-specific routes first, so /faq, /vs, /sign-in etc. still win. This
//   only handles otherwise-unmatched single-segment root paths, and returns 404
//   unless the segment is exactly "<INDEXNOW_KEY>.txt". If you prefer zero risk
//   of shadowing, instead drop a static file at public/<key>.txt and delete this
//   route — but then the key lives in your repo. This dynamic approach keeps it
//   in env only.
//
// Set INDEXNOW_KEY in Vercel (e.g. a 32-char hex string). Keep it server-only.
// =============================================================================

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ indexnowKey: string }> },
) {
  const { indexnowKey } = await params
  const key = process.env.INDEXNOW_KEY

  if (key && indexnowKey === `${key}.txt`) {
    return new Response(key, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  }

  return new Response('Not Found', { status: 404 })
}