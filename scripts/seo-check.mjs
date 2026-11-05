// node scripts/seo-check.mjs [baseUrl] [--all-locales]
//
// The page checklist from the 4 Nov 2026 audit (docs/seo/site-audit-2026-11-04.md),
// run against what a crawler actually receives: every English URL in the
// sitemap, fetched as Googlebot, parsed from the served HTML. Point it at a
// preview deployment before promoting it, or at production after.
//
// FAIL (exit 1) — things that have already happened on this site and cost
// something when they did:
//   - a page that does not answer 200
//   - no <title>, no meta description, or not exactly one <h1>
//   - a canonical that is missing, relative, or points at another page
//   - noindex on a public page
//   - JSON-LD that does not parse, or carries a relative URL
//   - AggregateRating anywhere (no real ratings exist; a fake one is a
//     manual-action trigger)
//   - FAQPage questions that do not appear on the page (the 92-page problem)
// WARN — worth fixing, never blocking:
//   - title over 60 characters, description over 160
//   - first paragraph after the H1 under 40 words (no direct answer)
//
// Default base is production. Locale copies are skipped unless --all-locales:
// they share templates with English, so English failing is the signal.

const args = process.argv.slice(2)
const base = (args.find((a) => /^https?:\/\//.test(a)) || 'https://dialerseat.com').replace(/\/$/, '')
const allLocales = args.includes('--all-locales')
const LOCALES = ['es', 'pt-br', 'fr', 'ar', 'it', 'de', 'zh-cn', 'he', 'ja', 'fil', 'hi']
const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

const dec = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
const strip = (s) => dec(s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
const one = (html, re) => { const m = html.match(re); return m ? dec(m[1]) : null }

const sitemap = await (await fetch(`${base}/sitemap.xml`, { headers: { 'user-agent': UA } })).text()
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1].replace('https://dialerseat.com', base))
  .filter((u) => allLocales || !LOCALES.includes(new URL(u).pathname.split('/')[1]))

async function check(url) {
  const fails = []
  const warns = []
  const res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': UA } })
  if (res.status !== 200) return { url, fails: [`status ${res.status}`], warns }
  const html = await res.text()
  const [head, body = ''] = html.split('</head>')
  const title = one(head, /<title[^>]*>([^<]*)<\/title>/)
  const desc = one(head, /<meta name="description" content="([^"]*)"/)
  const canonical = one(head, /<link rel="canonical" href="([^"]*)"/)
  const robots = one(head, /<meta name="robots" content="([^"]*)"/)
  const h1 = (body.match(/<h1[\s>]/g) || []).length

  if (!title) fails.push('no <title>')
  else if (title.length > 60) warns.push(`title ${title.length} chars`)
  if (!desc) fails.push('no meta description')
  else if (desc.length > 160) warns.push(`description ${desc.length} chars`)
  // /sign-up is Clerk's form, which draws its own heading in the browser; the
  // page is listed so a brand search for it resolves, not to rank on content.
  const isAuthPage = /^\/sign-(up|in)(\/|$)/.test(new URL(url).pathname)
  if (h1 !== 1 && !isAuthPage) fails.push(`${h1} <h1>`)
  if (robots && /noindex/i.test(robots)) fails.push('noindex')
  const path = new URL(url).pathname.replace(/\/$/, '') || '/'
  if (!canonical) fails.push('no canonical')
  else if (!/^https:\/\//.test(canonical)) fails.push(`relative canonical ${canonical}`)
  else if ((new URL(canonical).pathname.replace(/\/$/, '') || '/') !== path) fails.push(`canonical points elsewhere: ${canonical}`)

  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  if (/AggregateRating/.test(blocks.join(''))) fails.push('AggregateRating')
  if (/"(url|item|@id)":"\//.test(blocks.join(''))) fails.push('relative URL in JSON-LD')
  const questions = []
  for (const b of blocks) {
    let j
    try { j = JSON.parse(b) } catch { fails.push('JSON-LD does not parse'); continue }
    for (const o of [].concat(j['@graph'] || j)) {
      if (o && o['@type'] === 'FAQPage') for (const q of o.mainEntity || []) questions.push(String(q.name))
    }
  }
  if (questions.length) {
    const visible = strip(body.replace(/<script[\s\S]*?<\/script>/g, ' '))
    const hidden = questions.filter((q) => !visible.includes(q.replace(/\s+/g, ' ').trim()))
    if (hidden.length) fails.push(`${hidden.length}/${questions.length} FAQ questions not on the page, e.g. "${hidden[0]}"`)
  }

  const main = (body.match(/<main[\s\S]*?<\/main>/) || [body])[0]
  const afterH1 = main.split(/<\/h1>/)[1] || ''
  const first = [...afterH1.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => strip(m[1])).find((t) => t.split(' ').length >= 8) || ''
  if (first && first.split(' ').length < 40) warns.push(`opening paragraph ${first.split(' ').length} words`)
  return { url, fails, warns }
}

const results = []
const queue = [...urls]
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const u = queue.shift()
    try { results.push(await check(u)) } catch (e) { results.push({ url: u, fails: [`fetch failed: ${e.message}`], warns: [] }) }
  }
}))
results.sort((a, b) => a.url.localeCompare(b.url))

const failed = results.filter((r) => r.fails.length)
const warnCount = {}
for (const r of results) for (const w of r.warns) { const k = w.replace(/\d+/g, 'N'); warnCount[k] = (warnCount[k] || 0) + 1 }
for (const r of failed) console.log(`FAIL ${r.url.replace(base, '') || '/'}\n  ${r.fails.join('\n  ')}`)
console.log(`\n${results.length} pages checked against ${base}: ${failed.length} failing`)
for (const [k, n] of Object.entries(warnCount)) console.log(`  warn: ${k} on ${n} pages`)
process.exit(failed.length ? 1 : 0)
