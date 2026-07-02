import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import JoinRedeemClient from './JoinRedeemClient'
























export const dynamic = 'force-dynamic'

export default async function JoinCodePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code: rawCode } = await params
  const code = (rawCode || '').trim().toUpperCase()

  const { userId } = await auth()

  if (!userId) {
    
    const returnTo = `/join/${encodeURIComponent(code)}`
    redirect(`/sign-up?redirect_url=${encodeURIComponent(returnTo)}`)
  }

  
  return <JoinRedeemClient code={code} />
}