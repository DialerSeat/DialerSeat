// dev.dialerseat.com/robots.txt — its own, because it is its own site. The
// console, welcome and sign-in pages are private; the landing page and docs
// are what developers search for.
export const dynamic = 'force-static'

export function GET() {
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /console',
    'Disallow: /welcome',
    'Disallow: /sign-in',
    'Disallow: /sign-up',
    '',
    'Sitemap: https://dev.dialerseat.com/sitemap.xml',
    '',
  ].join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
