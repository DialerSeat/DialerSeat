// node scripts/seo-links.mjs [baseUrl] [--json out.json]
//
// The internal-link half of the audit, run the same way as seo-check.mjs:
// every English URL in the sitemap, fetched as Googlebot, parsed from served
// HTML. A page nothing links to depends on the sitemap alone to be found.
//
// Reports:
//   - broken internal links (not 200), and which pages carry them
//   - links that redirect, which spend a hop on every crawl
//   - pages reachable only through site-wide navigation or not at all:
//     "body links" counts links from page content, with header, footer, nav
//     and aside stripped, because a rail link on every page says little about
//     what a given page is related to
//   - click depth from the homepage
//   - images with no alt attribute
//
// Exits 1 on a broken internal link. Everything else is a reading, not a verdict.

const args = process.argv.slice(2)
const base = (args.find((a) => /^https?:\/\//.test(a)) || 'https://dialerseat.com').replace(/\/$/, '')
const jsonAt = args.indexOf('--json')
const LOCALES = ['es', 'pt-br', 'fr', 'ar', 'it', 'de', 'zh-cn', 'he', 'ja', 'fil', 'hi']
const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

const sitemap = await (await fetch(`${base}/sitemap.xml`, { headers: { 'user-agent': UA } })).text()
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => new URL(m[1]).pathname.replace(/\/$/, '') || '/')
  .filter((p) => !LOCALES.includes(p.split('/')[1]))
const listed = new Set(pages)

const hrefs = (html) => [...html.matchAll(/<a\b[^>]*?href="([^"#]*)[^"]*"/g)]
  .map((m) => m[1])
  .filter((h) => h.startsWith('/') || h.startsWith(base))
  .map((h) => (h.startsWith(base) ? h.slice(base.length) : h))
  .map((h) => h.split('?')[0].replace(/\/$/, '') || '/')

const body = (html) => html
  .replace(/<script\b[\s\S]*?<\/script>/g, '')
  .replace(/<style\b[\s\S]*?<\/style>/g, '')
  .replace(/<(header|footer|nav|aside)\b[\s\S]*?<\/\1>/g, '')

const outAll = new Map()
const outBody = new Map()
const noAlt = new Map()

async function crawl(path) {
  const res = await fetch(base + path, { headers: { 'user-agent': UA } })
  const html = await res.text()
  outAll.set(path, new Set(hrefs(html)))
  outBody.set(path, new Set(hrefs(body(html))))
  const missing = [...html.matchAll(/<img\b[^>]*>/g)].filter((m) => !/\balt=/.test(m[0])).length
  if (missing) noAlt.set(path, missing)
}

const queue = [...pages]
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) await crawl(queue.shift()).catch((e) => console.error('crawl failed', e.message))
}))

// Every distinct internal target, checked once, without following redirects.
const targets = new Set()
for (const s of outAll.values()) for (const t of s) targets.add(t)
const status = new Map()
const tq = [...targets]
await Promise.all(Array.from({ length: 8 }, async () => {
  while (tq.length) {
    const t = tq.shift()
    try {
      const r = await fetch(base + t, { headers: { 'user-agent': UA }, redirect: 'manual' })
      status.set(t, { code: r.status, to: r.headers.get('location') })
    } catch { status.set(t, { code: 0 }) }
  }
}))

const inbound = (map) => {
  const c = new Map(pages.map((p) => [p, new Set()]))
  for (const [from, set] of map) for (const t of set) if (t !== from && c.has(t)) c.get(t).add(from)
  return c
}
const inAll = inbound(outAll)
const inBody = inbound(outBody)

// Click depth over all links, the way a crawler walks it.
const depth = new Map([['/', 0]])
const walk = ['/']
while (walk.length) {
  const p = walk.shift()
  for (const t of outAll.get(p) ?? []) {
    if (listed.has(t) && !depth.has(t)) { depth.set(t, depth.get(p) + 1); walk.push(t) }
  }
}

const sourcesOf = (t) => [...outAll].filter(([, s]) => s.has(t)).map(([p]) => p)
const broken = [...status].filter(([, s]) => s.code >= 400 || s.code === 0)
const redirects = [...status].filter(([, s]) => s.code >= 300 && s.code < 400)
const unlisted = [...status].filter(([t, s]) => s.code === 200 && !listed.has(t)).map(([t]) => t)
const rows = pages.map((p) => ({ path: p, bodyLinks: inBody.get(p).size, allLinks: inAll.get(p).size, depth: depth.get(p) ?? null }))

console.log(`${pages.length} pages, ${targets.size} internal targets on ${base}\n`)
console.log(`BROKEN (${broken.length})`)
for (const [t, s] of broken) console.log(`  ${s.code} ${t}  from ${sourcesOf(t).slice(0, 3).join(', ')}`)
console.log(`\nREDIRECTING (${redirects.length})`)
for (const [t, s] of redirects) console.log(`  ${s.code} ${t} -> ${s.to}  from ${sourcesOf(t).slice(0, 2).join(', ')}`)
console.log(`\n200 BUT NOT IN THE SITEMAP (${unlisted.length})`)
for (const t of unlisted) console.log(`  ${t}`)
const orphans = rows.filter((r) => r.allLinks === 0 && r.path !== '/')
console.log(`\nNO INTERNAL LINKS AT ALL (${orphans.length})`)
for (const r of orphans) console.log(`  ${r.path}`)
const thin = rows.filter((r) => r.bodyLinks === 0 && r.path !== '/').sort((a, b) => a.path.localeCompare(b.path))
console.log(`\nNO LINK FROM ANY PAGE'S CONTENT (${thin.length})`)
for (const r of thin) console.log(`  ${r.path}  (nav links ${r.allLinks}, depth ${r.depth})`)
const hist = {}
for (const r of rows) hist[r.depth ?? 'unreachable'] = (hist[r.depth ?? 'unreachable'] || 0) + 1
console.log(`\nCLICK DEPTH ${JSON.stringify(hist)}`)
console.log(`IMAGES WITHOUT ALT on ${noAlt.size} pages`)
for (const [p, n] of noAlt) console.log(`  ${n} ${p}`)

if (jsonAt >= 0) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(args[jsonAt + 1], JSON.stringify(rows, null, 1))
}
process.exit(broken.length ? 1 : 0)
