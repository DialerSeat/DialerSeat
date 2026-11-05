'use client'

import Link from '@/components/LocaleLink'
import { t, useLocale } from '@/lib/i18n/client'
import { msg } from '@/lib/i18n/msg'
import { ENGLISH_ONLY_PATHS } from '@/lib/tools/registry'
import type { RelatedLink } from '@/lib/relatedLinks'

// The block lib/relatedLinks.ts feeds. A client component so it can sit in the
// client-rendered views too; the links are still in the served HTML. On a
// translated page a link to a tool that is still English only is left out.

export default function RelatedLinks({ links }: { links: RelatedLink[] | undefined }) {
  const { locale } = useLocale()
  const shown = links?.filter((l) => locale === 'en' || !ENGLISH_ONLY_PATHS.has(l.href))
  if (!shown?.length) return null
  return (
    <section className="guts-sec">
      <style>{`
        .related-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
        .guts-sec .related-links a:not(.guts-btn) { padding: 9px 14px; background: #fff; border: 1px solid #d8dce4; border-radius: 8px; color: #1a1c24; font-size: 13.5px; text-decoration: none; }
        .guts-sec .related-links a:not(.guts-btn):hover { border-color: #2a6eff; }
      `}</style>
      <h2>{t(msg("Related"))}</h2>
      <div className="related-links">
        {shown.map((l) => <Link key={l.href} href={l.href}>{t(l.label, l.vars)}</Link>)}
      </div>
    </section>
  )
}
