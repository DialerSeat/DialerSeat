import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

async function loadJost() {
  const res = await fetch(
    'https://fonts.gstatic.com/s/jost/v15/92zPtBhPNqw79Ij1E865zBUv7myjJQVGPokMmuHL.woff2'
  )
  return res.arrayBuffer()
}

export default async function Icon() {
  const fontData = await loadJost()

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
          fontWeight: 800,
          fontSize: 22,
          fontFamily: 'Jost',
          letterSpacing: -1,
        }}
      >
        D
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Jost', data: fontData, style: 'normal', weight: 800 }],
    }
  )
}