import { ImageResponse } from 'next/og'
import { verifyShareTitle } from '@/lib/shareImage'

// =============================================================================
// /og — the link-preview image for any page, carrying that page's title
// =============================================================================
// See lib/shareImage.ts for why this exists and why the title is signed.
// /og?t=<title>&s=<signature> renders the title; anything else renders the
// brand card, so an unsigned or tampered URL can never put words in our mouth.
//
// Same look as app/opengraph-image.tsx: the dark field, the blue D and the
// spaced wordmark, so a DialerSeat link reads as DialerSeat in any feed.
// =============================================================================

export const runtime = 'nodejs'

const size = { width: 1200, height: 630 }

async function loadJost(weight: number): Promise<ArrayBuffer> {
  const cssRes = await fetch(`https://fonts.googleapis.com/css2?family=Jost:wght@${weight}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  const css = await cssRes.text()
  const match = css.match(/src: url\(([^)]+)\) format\('(opentype|truetype|woff2)'\)/)
  if (!match) throw new Error('Failed to parse Jost font CSS')
  const fontRes = await fetch(match[1])
  return fontRes.arrayBuffer()
}

// One download per server instance, not one per image.
let fonts: Promise<[ArrayBuffer, ArrayBuffer]> | null = null
function jost() {
  if (!fonts) fonts = Promise.all([loadJost(700), loadJost(800)]).catch((e) => { fonts = null; throw e })
  return fonts
}

function Mark({ tile, word }: { tile: number; word: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: tile * 0.28 }}>
      <div
        style={{
          width: tile, height: tile, borderRadius: tile * 0.2,
          background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: tile * 0.66, fontWeight: 800, color: 'white',
        }}
      >
        D
      </div>
      <div style={{ fontSize: word, fontWeight: 800, letterSpacing: word / 6, color: 'white' }}>DIALERSEAT</div>
    </div>
  )
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const t = searchParams.get('t') || ''
  const s = searchParams.get('s') || ''
  const title = t && s && t.length <= 120 && verifyShareTitle(t, s) ? t : null

  const [bold, extraBold] = await jost()
  const titleSize = !title ? 0 : title.length > 72 ? 52 : title.length > 44 ? 60 : 68

  const image = new ImageResponse(
    title ? (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '64px 80px',
          background: '#0a0a0f', color: 'white', fontFamily: 'Jost',
        }}
      >
        <Mark tile={64} word={30} />
        <div style={{ display: 'flex', fontSize: titleSize, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1, maxWidth: 1040 }}>
          {title}
        </div>
        <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, letterSpacing: 5, color: '#4a9eff' }}>
          $35 / WEEK · NO CONTRACT · DIALERSEAT.COM
        </div>
      </div>
    ) : (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0a0a0f', color: 'white', fontFamily: 'Jost',
        }}
      >
        <Mark tile={120} word={72} />
        <div style={{ fontSize: 48, fontWeight: 700, marginTop: 48, marginBottom: 24, letterSpacing: -1 }}>
          Dial smarter. Close faster.
        </div>
        <div style={{ fontSize: 22, letterSpacing: 6, color: '#4a9eff', fontWeight: 700 }}>$35 / WEEK · NO CONTRACTS</div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Jost', data: bold, style: 'normal', weight: 700 },
        { name: 'Jost', data: extraBold, style: 'normal', weight: 800 },
      ],
    },
  )
  // The URL already encodes the content (title + signature), so a cached copy
  // can never be stale. Long CDN caching keeps link unfurls instant.
  image.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable')
  return image
}
