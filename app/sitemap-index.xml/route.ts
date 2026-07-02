import { createClient } from '@supabase/supabase-js'























export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5 min — fresh enough; avoids hammering the DB

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'
const APEX = `https://${ROOT_DOMAIN}`

const RESERVED = new Set([
  'www', 'app', 'api', 'admin', 'dashboard', 'static', 'cdn', 'assets',
  'mail', 'email', 'smtp', 'imap', 'pop', 'docs', 'blog', 'help',
  'support', 'status',
])

function validSlug(slug: string): boolean {
  if (RESERVED.has(slug)) return false
  return /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(slug)
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const now = new Date().toISOString()

  
  const entries: { loc: string; lastmod: string }[] = [
    { loc: `${APEX}/sitemap.xml`, lastmod: now },
  ]

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )

    const { data, error } = await supabase
      .from('white_label_tenants')
      .select('slug, custom_domain, updated_at')
      .eq('status', 'active')
      .eq('is_active', true)

    if (!error && data) {
      for (const t of data) {
        const slug = (t.slug || '').toLowerCase()
        if (!validSlug(slug)) continue
        const lastmod = t.updated_at ? new Date(t.updated_at).toISOString() : now
        
        if (t.custom_domain) {
          entries.push({ loc: `https://${t.custom_domain}/sitemap.xml`, lastmod })
        } else {
          entries.push({ loc: `https://${slug}.${ROOT_DOMAIN}/sitemap.xml`, lastmod })
        }
      }
    }
  } catch {
    
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map(
        (e) =>
          `  <sitemap>\n` +
          `    <loc>${xmlEscape(e.loc)}</loc>\n` +
          `    <lastmod>${e.lastmod}</lastmod>\n` +
          `  </sitemap>`,
      )
      .join('\n') +
    `\n</sitemapindex>\n`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}