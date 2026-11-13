import { redirect } from 'next/navigation'
import { devBase } from '@/lib/developers/server'

export default async function DocsIndex() {
  redirect(`${await devBase()}/docs/quickstart`)
}
