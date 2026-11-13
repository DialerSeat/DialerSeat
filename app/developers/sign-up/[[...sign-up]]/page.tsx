import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DevSignUp } from '@/components/developers/DevAuth'

export const metadata: Metadata = { title: 'Create your developer account', robots: { index: false, follow: true } }

export default function Page() {
  return <Suspense><DevSignUp /></Suspense>
}
