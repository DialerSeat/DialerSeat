import { notFound } from 'next/navigation'
import VerticalView, { verticalMetadata } from '@/components/VerticalView'
import { verticalBySlug } from '@/lib/verticals'

// Content lives in lib/verticals.ts; the layout in components/VerticalView.
const V = verticalBySlug('debt-collection')

export const metadata = V ? verticalMetadata(V) : {}

export default function Page() {
  if (!V) notFound()
  return <VerticalView v={V} />
}
