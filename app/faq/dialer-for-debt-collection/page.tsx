import { notFound } from 'next/navigation'
import VerticalView, { verticalMetadata } from '@/components/VerticalView'
import { verticalBySlug } from '@/lib/verticals'
import type { Metadata } from 'next'

// Content lives in lib/verticals.ts; the layout in components/VerticalView.
const V = verticalBySlug('debt-collection')

export async function generateMetadata(): Promise<Metadata> {
  return V ? verticalMetadata(V) : {}
}

export default function Page() {
  if (!V) notFound()
  return <VerticalView v={V} />
}
