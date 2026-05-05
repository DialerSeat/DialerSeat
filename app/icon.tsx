import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
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
          borderRadius: 7,
          color: 'white',
          fontWeight: 900,
          fontSize: 22,
          fontFamily: 'sans-serif',
          letterSpacing: -1,
        }}
      >
        D
      </div>
    ),
    { ...size }
  )
}