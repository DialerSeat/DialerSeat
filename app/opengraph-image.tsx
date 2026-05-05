import { ImageResponse } from 'next/og'

export const alt = 'DialerSeat — Dial smarter. Close faster.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
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
          fontFamily: 'sans-serif',
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
              fontWeight: 900,
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
              fontWeight: 900,
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
    { ...size }
  )
}