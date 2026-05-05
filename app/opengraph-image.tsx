import { ImageResponse } from 'next/og'

export const alt = 'DialerSeat — Dial smarter. Close faster.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

async function loadJost(weight: '500' | '700' | '800') {
  const urls: Record<string, string> = {
    '500': 'https://fonts.gstatic.com/s/jost/v15/92zPtBhPNqw79Ij1E865zBUv7myjFwVGPokMmuHL.woff2',
    '700': 'https://fonts.gstatic.com/s/jost/v15/92zPtBhPNqw79Ij1E865zBUv7myjLgVGPokMmuHL.woff2',
    '800': 'https://fonts.gstatic.com/s/jost/v15/92zPtBhPNqw79Ij1E865zBUv7myjJQVGPokMmuHL.woff2',
  }
  const res = await fetch(urls[weight])
  return res.arrayBuffer()
}

export default async function OpengraphImage() {
  const [bold, extraBold] = await Promise.all([
    loadJost('700'),
    loadJost('800'),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0f',
          color: 'white',
          fontFamily: 'Jost',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            marginBottom: 48,
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 24,
              background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 80,
              fontWeight: 800,
              color: 'white',
              letterSpacing: -3,
              boxShadow: '0 0 80px rgba(74,158,255,0.4)',
            }}
          >
            D
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: 12,
              color: 'white',
            }}
          >
            DIALERSEAT
          </div>
        </div>

        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: 'white',
            marginBottom: 24,
            letterSpacing: -1,
            textAlign: 'center',
          }}
        >
          Dial smarter. Close faster.
        </div>

        <div
          style={{
            fontSize: 22,
            letterSpacing: 6,
            color: '#4a9eff',
            fontWeight: 700,
          }}
        >
          $35 / WEEK · NO CONTRACTS
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Jost', data: bold, style: 'normal', weight: 700 },
        { name: 'Jost', data: extraBold, style: 'normal', weight: 800 },
      ],
    }
  )
}