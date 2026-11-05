// ── SUBDOMAINS A TENANT CANNOT CLAIM ────────────────────────────────
// Plain data with no React and no Next imports, so proxy.ts can import it in
// the middleware runtime the same way it imports lib/i18n/locales.ts.
//
// THIS WAS FIVE LISTS, AND THEY DID NOT AGREE.
//   proxy.ts                               18 names — the runtime gate
//   app/api/whitelabel/check-subdomain     66 names — the availability check
//   app/api/whitelabel/onboarding          66 names — the self-serve create
//   app/api/admin/tenants                  23 names — the admin create
//   app/api/admin/tenants/[id]             23 names — the admin rename
//
// Two gates decide a tenant subdomain, and both of them had holes. The API
// lists decide what can be created, and the admin pair was a third the length
// of the self-serve pair, so an admin could put a tenant on a slug the public
// form refuses. proxy.ts then decides what a hostname MEANS, and its list was
// the shortest of all: 'team' is blocked from being created but was never
// blocked from being routed, which is only safe for as long as every create
// path holds.
//
// A name belongs here when a stranger's brand sitting on it would be read as
// us. That is not the same as "a name we happen to use" — it is why vendor
// names stay listed after we stop using the vendor, and why the group below
// is derived from the pages we actually publish.
//
// tests/unit/siteIndexing.test.ts fails if a top-level public route is not in
// this set.

/** The site's own infrastructure and the hostnames mail and DNS reserve. */
const INFRASTRUCTURE = [
  'www', 'api', 'app', 'admin', 'dashboard', 'auth', 'billing', 'onboarding',
  'cdn', 'assets', 'static', 'media', 'images', 'files', 'upload', 'public',
  'mail', 'email', 'smtp', 'imap', 'pop', 'ftp', 'mx', 'ns', 'ns1', 'ns2',
  'staging', 'dev', 'test', 'preview', 'sandbox', 'demo-internal',
  'sip', 'voice', 'webhook', 'webhooks', 'callback', 'oauth', 'saml',
  'signin', 'signup', 'sign-in', 'sign-up', 'login', 'logout',
  'account', 'settings', 'status', 'docs', 'help', 'blog', 'home',
]

// Vendor names stay blocked even after we stop using the vendor: dropping
// 'signalwire' would newly allow a tenant to claim it, which is worse than an
// obsolete entry costing nothing.
const VENDORS = [
  'signalwire', 'telnyx', 'stripe', 'clerk', 'supabase', 'vercel', 'sentry',
]

/** Our own name, our plans, and the words the dashboard uses for a role. */
const PRODUCT = [
  'dialerseat', 'whitelabel', 'white-label', 'wl',
  'manager', 'managers', 'pro', 'team', 'teams', 'seat', 'seats',
]

// ── THE PAGES WE PUBLISH ─────────────────────────────────────────────
// The convention was already here — 'about', 'pricing', 'faq' and 'terms'
// were reserved because they are pages. It had simply stopped keeping up with
// the pages, so this group is the full top-level set and a test holds it
// there.
const PAGES = [
  'about', 'contact', 'pricing', 'features', 'resources', 'faq', 'vs',
  'dialing-modes', 'data', 'tools', 'screenshots', 'partners',
  'terms', 'privacy', 'security', 'embed', 'join', 'welcome',
  'md', 'og', 'llms',
]

// ── THE PARTNER PROGRAM, UNDER THE NAMES PEOPLE TYPE ─────────────────
// /partners publishes a creator-code and reseller program and asks people to
// write to team@dialerseat.com. Somebody who reads it and guesses at a URL
// should not land on a stranger's dialer. 'referral' and 'promo' were already
// here for the same reason, from the codes that came before the page.
const PROGRAM = [
  'partner', 'affiliate', 'affiliates',
  'creator', 'creators', 'reseller', 'resellers',
  'referral', 'referrals', 'promo', 'promos',
]

/** Addresses we publish or are obliged to honour (RFC 2142). */
const MAILBOXES = ['support', 'sales', 'legal', 'abuse', 'postmaster', 'noreply', 'no-reply']

export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  ...INFRASTRUCTURE,
  ...VENDORS,
  ...PRODUCT,
  ...PAGES,
  ...PROGRAM,
  ...MAILBOXES,
])

/**
 * Whether a tenant slug is ours. Case-folded, because a hostname is
 * case-insensitive and a slug typed into a form is not.
 */
export function isReservedSubdomain(slug: string): boolean {
  return RESERVED_SUBDOMAINS.has(slug.trim().toLowerCase())
}
