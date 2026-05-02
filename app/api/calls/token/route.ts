import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
    const projectId = process.env.SIGNALWIRE_PROJECT_ID
    const apiToken = process.env.SIGNALWIRE_API_TOKEN
    const sipUsername = process.env.SIGNALWIRE_SIP_USERNAME

    const response = await fetch(
      `https://${spaceUrl}/api/relay/rest/jwt`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expires_in: 3600,
          resource: sipUsername,
        }),
      }
    )

    const data = await response.json()
    console.log('Token response:', JSON.stringify(data).substring(0, 150))

    const token = data.jwt_token
    if (!token) {
      return NextResponse.json({ success: false, error: 'No token', raw: data }, { status: 500 })
    }

    return NextResponse.json({ success: true, token })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}