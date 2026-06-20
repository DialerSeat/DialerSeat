// =============================================================================
// lib/indexnow.ts — instant URL submission to search engines (v1)
// =============================================================================
// IndexNow (https://www.indexnow.org) is a protocol supported by Bing, Yandex,
// Seznam, Naver, and others. You POST a list of URLs + a shared key, and those
// engines crawl them within MINUTES instead of days. Google does NOT use
// IndexNow, but Google DOES re-read your sitemap on a schedule, and a sitemap
// "ping" nudges it — so we do both:
//   1. submitToIndexNow(urls)  → instant Bing/Yandex/etc.
//   2. pingGoogleSitemap()     → nudge Google to re-read the sitemap index
//
// SETUP (one-time):
//   1. Pick a key: any 8–128 hex chars. We default to env INDEXNOW_KEY.
//   2. Serve it at a key file. We expose it at:
//         https://dialerseat.com/<key>.txt   (route below in your app)
//      IndexNow fetches that file to verify you own the domain.
//   3. Set INDEXNOW_KEY in Vercel env (and optionally NEXT_PUBLIC_INDEXNOW_KEY
//      is NOT needed — keep it server-only).
//
// Call submitOnTenantCreated(slug) from your tenant-creation route AND
// whenever a subdomain goes live. It's fire-and-forget and never throws.
// =============================================================================

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'
const APEX = `https://${ROOT_DOMAIN}`

function getKey(): string | null {
  return process.env.INDEXNOW_KEY || null
}

/**
 * Submit a batch of URLs to IndexNow (Bing, Yandex, etc.). Fire-and-forget:
 * resolves to true on 200/202, false otherwise; never throws.
 *
 * All URLs must be on the same host as `host` (IndexNow requirement).
 */
export async function submitToIndexNow(
  urls: string[],
  host: string = ROOT_DOMAIN,
): Promise<boolean> {
  const key = getKey()
  if (!key || urls.length === 0) return false

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${APEX}/${key}.txt`,
        urlList: urls,
      }),
      // Don't let a slow engine hang the request that triggered this.
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch (err) {
    console.error('[indexnow] submit failed:', err)
    return false
  }
}

/**
 * Nudge Google to re-read the master sitemap index. Google deprecated the old
 * /ping endpoint, so the reliable nudge today is simply ensuring the sitemap is
 * fresh (force-dynamic) and submitted once in Search Console. This function
 * additionally requests the sitemap index so any CDN cache is warmed and the
 * lastmod reflects the new tenant. Safe, cheap, never throws.
 */
export async function pingGoogleSitemap(): Promise<void> {
  try {
    await fetch(`${APEX}/sitemap-index.xml`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    /* non-fatal */
  }
}

/**
 * Call this the moment a tenant subdomain goes live (or its public content
 * changes). Submits the subdomain's public URLs to IndexNow and warms the
 * sitemap index. Fire-and-forget — safe to `void` it from a route handler.
 */
export async function submitOnTenantLive(slug: string): Promise<void> {
  const clean = (slug || '').toLowerCase().trim()
  if (!/^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(clean)) return

  const host = `${clean}.${ROOT_DOMAIN}`
  const base = `https://${host}`
  const urls = [`${base}/`, `${base}/sign-in`, `${base}/sign-up`]

  // IndexNow requires the submitted URLs to match the `host` field. Submit the
  // subdomain's URLs under the subdomain host; the keyLocation stays on the apex
  // (IndexNow allows the key to live on the parent domain for subdomains).
  await Promise.allSettled([
    submitToIndexNow(urls, host),
    pingGoogleSitemap(),
  ])
}

/**
 * Submit apex marketing URLs to IndexNow — call after deploying new/updated
 * marketing pages so Bing/Yandex re-crawl quickly.
 */
export async function submitApexUrls(paths: string[]): Promise<boolean> {
  const urls = paths.map((p) => `${APEX}${p.startsWith('/') ? p : `/${p}`}`)
  return submitToIndexNow(urls, ROOT_DOMAIN)
}