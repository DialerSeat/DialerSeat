import { competitorBySlug } from '@/lib/competitors'

// =============================================================================
// "PROS AND CONS OF X" — the phrasing buyers actually search, on every /vs page
// =============================================================================
// People comparing dialers rarely type "DialerSeat vs ReadyMode". They type
// "cons of ReadyMode", "ReadyMode pros and cons", and increasingly they ask an
// AI assistant the same question in a sentence. Every /vs page already HAS
// the answer — lib/competitors carries each tool's genuine strengths (wins)
// and where buyers get caught out (friction) — it just never used the words.
//
// WHAT ACTUALLY MOVES A RANKING, IN ORDER. The keywords tag below is the least
// of it: Google has ignored <meta name="keywords"> since 2009, and it is here
// because it is free and some smaller engines still read it. What does the
// work is the phrase appearing in:
//
//   1. the page's own headings   components/vs-competitor-view
//   2. FAQ structured data       prosConsFaqs() below, quoted into results
//   3. the markdown exports      app/md, app/llms-full.txt, which is what AI
//                                  crawlers read instead of the rendered page
//
// NOTHING NEW IS CLAIMED HERE. Both answers are assembled from the wins and
// friction fields that already render on the page, so the structured data can
// never say something about a competitor that the page does not.
// =============================================================================

/** Search phrases for a competitor page, in the forms people actually type. */
export function prosConsKeywords(slug: string): string[] {
  const c = competitorBySlug(slug)
  if (!c) return []
  const n = c.name
  return [
    `${n} pros and cons`,
    `pros and cons of ${n}`,
    `cons of ${n}`,
    `${n} cons`,
    `${n} review`,
    `${n} pricing`,
    `${n} alternative`,
    `${n} alternatives`,
    `${n} vs DialerSeat`,
  ]
}

/** Join list items into one sentence, ending in a full stop. */
function sentence(items: string[]): string {
  return `${items.join('; ')}.`
}

/**
 * Two FAQ entries answering the pros-and-cons questions directly, built only
 * from the competitor's own wins and friction.
 *
 * They go into the page's FAQPage schema ALONGSIDE its hand-written questions,
 * never replacing them — the hand-written ones carry pricing detail these do
 * not.
 */
export function prosConsFaqs(slug: string): { question: string; answer: string }[] {
  const c = competitorBySlug(slug)
  if (!c) return []
  return [
    {
      question: `What are the pros and cons of ${c.name}?`,
      answer:
        `Pros of ${c.name}: ${sentence(c.wins)} ` +
        `Cons of ${c.name}: ${sentence(c.friction)} ` +
        `Who it suits best: ${c.bestFor}`,
    },
    {
      question: `What are the cons of ${c.name}?`,
      answer:
        `The main cons of ${c.name} are: ${sentence(c.friction)} ` +
        `Pricing: ${c.pricing} Contract: ${c.contract}`,
    },
  ]
}
