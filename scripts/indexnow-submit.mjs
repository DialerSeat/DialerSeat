// =============================================================================
// scripts/indexnow-submit.mjs — tell Bing, Yandex and the rest what changed
// =============================================================================
// IndexNow is how a site tells Bing (and every engine that shares its feed:
// Yandex, Seznam, Naver) that a URL changed, instead of waiting for a crawl.
// Bing's index is also what several AI assistants search, so a page that is
// in Bing within minutes can be quoted within minutes.
//
// lib/indexnow.ts already submits white-label tenant pages as they go live.
// Nothing submitted the marketing site, and the key file it needs to verify
// was blocked by proxy.ts until 2026-09-25, so no submission could have
// verified before then anyway.
//
//   node scripts/indexnow-submit.mjs                    every URL in the sitemap
//   node scripts/indexnow-submit.mjs /pricing           only the paths given
//   node scripts/indexnow-submit.mjs --since 2026-09-25  URLs whose lastmod is on or after a date
//
// Run it after a deploy, against production. The key must match the file the
// live site serves at https://dialerseat.com/<key>.txt, or the submission is
// discarded; the script checks that first.
// =============================================================================

const HOST = 'dialerseat.com'
const APEX = `https://${HOST}`
// The key the marketing site submits with. An IndexNow key is public by
// design: engines verify it by fetching it from the site, so it is served as
// a static file, public/c2bb112f84ec1d07545c006b5d2d8f77.txt, and committed. The production
// INDEXNOW_KEY (used by lib/indexnow.ts for tenant pages) is a sensitive
// Vercel variable, which `vercel env run` passes to local commands as an empty
// string, so a script that depended on it could never run from a laptop.
// Setting INDEXNOW_KEY still overrides this.
const REPO_KEY = 'c2bb112f84ec1d07545c006b5d2d8f77'
const key = process.env.INDEXNOW_KEY || REPO_KEY

const args = process.argv.slice(2)
const sinceIdx = args.indexOf('--since')
const since = sinceIdx >= 0 ? args[sinceIdx + 1] : null
const paths = args.filter((a, i) => !a.startsWith('--') && i !== sinceIdx + 1)

async function sitemapEntries() {
  const res = await fetch(`${APEX}/sitemap.xml`)
  if (!res.ok) throw new Error(`sitemap.xml returned ${res.status}`)
  const xml = await res.text()
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
    loc: (m[1].match(/<loc>(.*?)<\/loc>/) || [])[1],
    lastmod: (m[1].match(/<lastmod>(.*?)<\/lastmod>/) || [])[1] || '',
  })).filter((e) => e.loc)
}

async function main() {
  // The key file has to be reachable before anything is worth sending.
  const keyCheck = await fetch(`${APEX}/${key}.txt`)
  const keyBody = keyCheck.ok ? (await keyCheck.text()).trim() : ''
  if (keyBody !== key) {
    console.error(`${APEX}/${key}.txt did not return the key (HTTP ${keyCheck.status}). Deploy first, and check proxy.ts lets it through.`)
    process.exit(1)
  }

  let urls
  if (paths.length) {
    urls = paths.map((p) => (p.startsWith('http') ? p : `${APEX}${p.startsWith('/') ? p : `/${p}`}`))
  } else {
    const entries = await sitemapEntries()
    urls = entries.filter((e) => !since || e.lastmod.slice(0, 10) >= since).map((e) => e.loc)
  }

  if (urls.length === 0) {
    console.log('Nothing to submit.')
    return
  }

  // IndexNow accepts up to 10,000 URLs per request.
  for (let i = 0; i < urls.length; i += 10000) {
    const batch = urls.slice(i, i + 10000)
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key, keyLocation: `${APEX}/${key}.txt`, urlList: batch }),
    })
    console.log(`Submitted ${batch.length} URLs: HTTP ${res.status} ${res.status === 200 || res.status === 202 ? '(accepted)' : await res.text()}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
