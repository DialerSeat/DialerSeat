import Link from '@/components/LocaleLink'
import { getLocale, getT } from '@/lib/i18n/server'
import { TOOLS, toolPath, type ToolEntry } from '@/lib/tools/registry'

// =============================================================================
// THE FREE TOOLS THAT BELONG TO THIS PAGE
// =============================================================================
// A tool page earns nothing if no page links to it, and the reader of the
// calling-hours explainer is the person the calling-hours checker is for.
//
// An untranslated tool is left out of a translated page rather than sending a
// Spanish reader to English: `englishOnly` in lib/tools/registry.ts decides, so
// these links appear in every language by themselves once a tool is translated.
// Name and blurb come from the registry so a renamed tool can't leave a stale
// link behind.
// =============================================================================

export default async function ToolLinks({ slugs }: { slugs: string[] }) {
  const [locale, t] = await Promise.all([getLocale(), getT()])
  const tools = slugs
    .map((slug) => TOOLS.find((tool) => tool.slug === slug))
    .filter((tool): tool is ToolEntry => !!tool && (locale === 'en' || !tool.englishOnly))
  if (tools.length === 0) return null

  return (
    <section className="guts-sec">
      <style>{`
        .tool-links { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; text-align: start; }
        .guts-sec .tool-links a:not(.guts-btn) { display: block; padding: 16px 18px; background: #fff; border: 1px solid #d8dce4; border-radius: 8px; color: #1a1c24; text-decoration: none; }
        .guts-sec .tool-links a:not(.guts-btn):hover { border-color: #2a6eff; }
        .tool-links b { display: block; font-size: 14px; margin-bottom: 4px; }
        .tool-links span { display: block; font-size: 13px; line-height: 1.45; color: #5a6072; }
      `}</style>
      <h2>{t("Free tools")}</h2>
      <div className="tool-links">
        {tools.map((tool) => (
          <Link key={tool.slug} href={toolPath(tool.slug)}>
            <b>{t(tool.name)}</b>
            <span>{t(tool.blurb)}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
