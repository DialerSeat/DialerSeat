























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