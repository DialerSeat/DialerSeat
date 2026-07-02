








import { webhookUrl } from '@/lib/verifyWebhook'

const PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID!
const API_TOKEN = process.env.SIGNALWIRE_API_TOKEN!
const SPACE_URL = process.env.SIGNALWIRE_SPACE_URL!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

const baseUrl = `https://${SPACE_URL}/api/laml/2010-04-01/Accounts/${PROJECT_ID}`
const authHeader = 'Basic ' + Buffer.from(`${PROJECT_ID}:${API_TOKEN}`).toString('base64')

export interface AvailableNumber {
  phone_number: string
  friendly_name: string
  locality: string
  region: string  // SignalWire's "region" is the US state
  postal_code: string
  iso_country: string
}

export interface PurchasedNumber {
  sid: string
  phone_number: string
  friendly_name: string
  voice_url: string
  status_callback: string
}


export async function searchAvailableNumbers(
  areaCode: string,
  limit = 30
): Promise<AvailableNumber[]> {
  const params = new URLSearchParams({
    AreaCode: areaCode,
    PageSize: String(limit),
    VoiceEnabled: 'true',
  })
  const res = await fetch(
    `${baseUrl}/AvailablePhoneNumbers/US/Local.json?${params}`,
    { headers: { Authorization: authHeader } }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SignalWire search failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.available_phone_numbers ?? []
}


export async function purchaseNumber(phoneNumber: string): Promise<PurchasedNumber> {
  const params = new URLSearchParams({
    PhoneNumber: phoneNumber,
    VoiceUrl: webhookUrl(`${APP_URL}/api/calls/inbound`),
    VoiceMethod: 'POST',
    StatusCallback: webhookUrl(`${APP_URL}/api/calls/status`),
    StatusCallbackMethod: 'POST',
  })

  const res = await fetch(`${baseUrl}/IncomingPhoneNumbers.json`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SignalWire purchase failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return {
    sid: data.sid,
    phone_number: data.phone_number,
    friendly_name: data.friendly_name,
    voice_url: data.voice_url,
    status_callback: data.status_callback,
  }
}


export async function releaseNumber(signalwireSid: string): Promise<void> {
  const res = await fetch(`${baseUrl}/IncomingPhoneNumbers/${signalwireSid}.json`, {
    method: 'DELETE',
    headers: { Authorization: authHeader },
  })

  if (!res.ok && res.status !== 404) {
    
    const text = await res.text()
    throw new Error(`SignalWire release failed (${res.status}): ${text}`)
  }
}


export async function acquireNumberByAreaCode(
  areaCode: string
): Promise<PurchasedNumber | null> {
  const available = await searchAvailableNumbers(areaCode, 5)
  if (available.length === 0) return null

  
  
  for (const candidate of available) {
    try {
      return await purchaseNumber(candidate.phone_number)
    } catch (err) {
      console.warn(`Failed to purchase ${candidate.phone_number}, trying next:`, err)
      continue
    }
  }

  return null
}