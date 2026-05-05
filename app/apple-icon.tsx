import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
          color: 'white',
          fontWeight: 900,
          fontSize: 120,
          fontFamily: 'sans-serif',
          letterSpacing: -4,
        }}
      >
        D
      </div>
    ),
    { ...size }
  )
}