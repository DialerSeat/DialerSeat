






















const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'
const APEX = `https://${ROOT_DOMAIN}`

function getKey(): string | null {
  return process.env.INDEXNOW_KEY || null
}


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
      
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch (err) {
    console.error('[indexnow] submit failed:', err)
    return false
  }
}


export async function pingGoogleSitemap(): Promise<void> {
  try {
    await fetch(`${APEX}/sitemap-index.xml`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    
  }
}


export async function submitOnTenantLive(slug: string): Promise<void> {
  const clean = (slug || '').toLowerCase().trim()
  if (!/^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(clean)) return

  const host = `${clean}.${ROOT_DOMAIN}`
  const base = `https://${host}`
  const urls = [`${base}/`, `${base}/sign-in`, `${base}/sign-up`]

  
  
  
  await Promise.allSettled([
    submitToIndexNow(urls, host),
    pingGoogleSitemap(),
  ])
}


export async function submitApexUrls(paths: string[]): Promise<boolean> {
  const urls = paths.map((p) => `${APEX}${p.startsWith('/') ? p : `/${p}`}`)
  return submitToIndexNow(urls, ROOT_DOMAIN)
}