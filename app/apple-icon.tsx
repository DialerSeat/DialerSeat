import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

async function loadJost(weight: number) {
  const cssRes = await fetch(
    `https://fonts.googleapis.com/css2?family=Jost:wght@${weight}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  )
  const css = await cssRes.text()
  const match = css.match(/src: url\(([^)]+)\) format\('(opentype|truetype|woff2)'\)/)
  if (!match) throw new Error('Failed to parse Jost font CSS')
  const fontRes = await fetch(match[1])
  return fontRes.arrayBuffer()
}

export default async function AppleIcon() {
  const fontData = await loadJost(800)

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
          fontWeight: 800,
          fontSize: 120,
          fontFamily: 'Jost',
          letterSpacing: -4,
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