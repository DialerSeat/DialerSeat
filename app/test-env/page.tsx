'use client'
export default function TestEnv() {
  return (
    <div>
      <p>USERNAME: {process.env.NEXT_PUBLIC_SIGNALWIRE_SIP_USERNAME || 'NOT FOUND'}</p>
      <p>DOMAIN: {process.env.NEXT_PUBLIC_SIGNALWIRE_SIP_DOMAIN || 'NOT FOUND'}</p>
      <p>PASSWORD SET: {process.env.NEXT_PUBLIC_SIGNALWIRE_SIP_PASSWORD ? 'YES' : 'NO'}</p>
    </div>
  )
}