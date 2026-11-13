import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DevSignIn } from '@/components/developers/DevAuth'

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: true } }

export default function Page() {
  return <Suspense><DevSignIn /></Suspense>
}
