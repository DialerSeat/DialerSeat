import { DOCS } from '@/lib/developers/docs'

// dev.dialerseat.com/sitemap.xml — the landing page, every docs page and the
// API reference. Built from the docs data, so a new page is listed the moment
// it exists.
export const dynamic = 'force-static'

export function GET() {
  const base = 'https://dev.dialerseat.com'
  const urls = ['/', '/docs/api', ...DOCS.map(d => `/docs/${d.slug}`)]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${base}${u === '/' ? '' : u}</loc><changefreq>weekly</changefreq><priority>${u === '/' ? '1.0' : '0.8'}</priority></url>`).join('\n')}
</urlset>
`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
