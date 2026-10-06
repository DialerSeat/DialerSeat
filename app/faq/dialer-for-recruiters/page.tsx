import { notFound } from 'next/navigation'
import VerticalView, { verticalMetadata } from '@/components/VerticalView'
import { verticalBySlug } from '@/lib/verticals'
import { withShareImage } from '@/lib/i18n/metadata'
import type { Metadata } from 'next'

// Content lives in lib/verticals.ts; the layout in components/VerticalView.
const V = verticalBySlug('recruiters')

const baseMetadata: Metadata = V ? verticalMetadata(V) : {}

export async function generateMetadata(): Promise<Metadata> {
  return withShareImage(baseMetadata)
}

export default function Page() {
  if (!V) notFound()
  return <VerticalView v={V} />
}
