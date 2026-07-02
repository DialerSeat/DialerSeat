import { NextResponse } from 'next/server'



































const FAIL_OPEN_WHEN_UNSET = true


function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}


export function verifyWebhook(req: Request): NextResponse | null {
  const secret = process.env.SIGNALWIRE_WEBHOOK_SECRET

  if (!secret) {
    if (FAIL_OPEN_WHEN_UNSET) {
      console.warn(
        '[verifyWebhook] SIGNALWIRE_WEBHOOK_SECRET is not set — allowing webhook ' +
        'WITHOUT verification. Set the env var to enable enforcement.'
      )
      return null
    }
    
    console.error('[verifyWebhook] SIGNALWIRE_WEBHOOK_SECRET not set and fail-closed mode on. Rejecting.')
    return NextResponse.json({ error: 'Webhook auth not configured' }, { status: 503 })
  }

  let provided: string | null = null
  try {
    provided = new URL(req.url).searchParams.get('whk')
  } catch {
    provided = null
  }

  if (!provided || !timingSafeEqual(provided, secret)) {
    console.warn('[verifyWebhook] rejected webhook with missing/invalid whk param')
    
    
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null
}


export function webhookUrl(base: string): string {
  const secret = process.env.SIGNALWIRE_WEBHOOK_SECRET
  if (!secret) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}whk=${encodeURIComponent(secret)}`
}