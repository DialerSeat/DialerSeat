'use client'

// The developer site lives at the root of dev.dialerseat.com and at
// /developers everywhere else (localhost). Every internal link goes through
// DevLink so the same page works at both addresses.

import NextLink from 'next/link'
import { createContext, useContext, type ComponentProps } from 'react'

const BaseContext = createContext<string>('/developers')

export function DevBaseProvider({ base, children }: { base: string; children: React.ReactNode }) {
  return <BaseContext.Provider value={base}>{children}</BaseContext.Provider>
}

export function useDevBase(): string {
  return useContext(BaseContext)
}

/** '/console/api-keys' → '/developers/console/api-keys' on localhost, unchanged on the subdomain. */
export function withBase(base: string, href: string): string {
  if (/^(https?:|mailto:|#)/.test(href)) return href
  if (href === '/') return base || '/'
  return base + href
}

export function useDevHref() {
  const base = useDevBase()
  return (href: string) => withBase(base, href)
}

export function DevLink({ href, ...rest }: Omit<ComponentProps<typeof NextLink>, 'href'> & { href: string }) {
  const base = useDevBase()
  return <NextLink href={withBase(base, href)} {...rest} />
}

/** The main site. Absolute on the subdomain, '/' on localhost. */
export function useMainSiteUrl(): string {
  const base = useDevBase()
  return base === '' ? 'https://dialerseat.com' : '/'
}
