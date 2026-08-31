# Rebuilding the `/vs` and `/faq` pages

Read this before redesigning either. They look like the same problem and they
are not, and treating them the same is how you either destroy content or do the
same work fifteen times.

---

## The short version

| | `/vs` | `/faq` |
|---|---|---|
| Pages | 22 competitor pages + 3 specials | 28 |
| Structure | **One shared component** | **28 bespoke pages** |
| Redesign effort | Edit **one file** | Edit a **shared stylesheet**, not the pages |
| Where content lives | `lib/competitors.ts` + `lib/competitorFeatures.ts` | Inside each page |

`/vs` is now templated. `/faq` is deliberately not, and the reason matters —
see [Why /faq is different](#why-faq-is-different).

---

## Index pages vs article pages — they are not the same thing

This distinction is load-bearing and easy to lose.

| | File | Lines | What it is |
|---|---|---|---|
| `/vs` | `app/vs/view.tsx` | 602 | **Index.** Directory of every comparison |
| `/vs/readymode` | `components/vs-competitor-view.tsx` | ~400 | **Article.** One per competitor |
| `/faq` | `app/faq/view.tsx` | 820 | **Index.** Directory of every answer |
| `/faq/leads` | `app/faq/leads/view.tsx` | 395 | **Article.** One per topic |

**The two index pages are completely independent of the article templates.**
Neither imports `vs-competitor-view` or `competitorFeatures`. Nothing in the
`/vs` migration touched them, and a redesign of the article template will not
change how `/vs` or `/faq` look.

That separation is correct and should be kept. They are different jobs:

- **Index pages sell.** They are landing pages — someone arrives from an ad, an
  email, or a search and has to decide within seconds whether this is for them.
  They should be designed like the homepage: visual, opinionated, room to
  breathe.
- **Article pages inform.** Someone already comparing two tools, reading for
  detail. Dense, scannable, table-heavy, built to be quoted and to rank.

Designing them the same way makes the index too dense to convert and the
article too airy to be useful. **Redesign them separately, and expect them to
look different.**

---

## `/vs` — how it works now

### The three files

```
lib/competitors.ts          the narrative: pricing, contract, dialing,
                            wins[], friction[], bestFor, team{}, segment
lib/competitorFeatures.ts   the matrix: 296 rows of feature-by-feature
                            comparison, keyed by slug
components/vs-competitor-view.tsx   the only layout. 400 lines. Edit this
                            and all 22 pages change.
```

Each `app/vs/<slug>/page.tsx` is now ~70 lines of metadata and JSON-LD, ending in:

```tsx
export default function Page() {
  const competitor = competitorBySlug(SLUG)
  if (!competitor) notFound()
  return (<>{/* …JsonLd… */}<VsCompetitorView c={competitor} /></>)
}
```

### To redesign every comparison page

Edit `components/vs-competitor-view.tsx`. That is the whole job. There is no
second place to change, and no page that can drift out of sync — which was the
entire point of the migration.

The palette lives in the `T` object at the top of that file. Layout lives in the
single `<style>` block. Both are one edit.

### To add competitor #23

1. Add a record to `COMPETITORS` in `lib/competitors.ts`
2. Optionally add a matrix to `COMPETITOR_FEATURES` in `lib/competitorFeatures.ts`
3. Copy any existing `app/vs/<slug>/page.tsx`, change `SLUG`, the metadata and the FAQs

No view file. No layout. The `[matchup]` head-to-head pages generate themselves
from `crossShoppedPairs()`, so a new competitor with `crossShopped: true` and a
`segment` also produces pairwise pages for free.

### The three-state convention in the matrix

```ts
{ feature: 'Predictive dialer', dialerseat: true, competitor: 'Pro tier ($49+/mo) and up' }
```

- `true` → green check
- `false` → red cross
- **any string** → amber, italic

**The amber state is doing most of the honest work on these pages.** It covers
tier-gated, structurally different, and *claims we could not independently
confirm*. Reaching for `false` when the truth is "we don't know" turns a
comparison into an advert, and these pages are built to be quoted.

Related rule, already written into `lib/competitors.ts`: **only make claims
about ourselves.** Whether a competitor offers a trial is not something this
repo knows. Inventing an absence to win a row spends the credibility the whole
page depends on.

---

## `/faq` — one visual language, kept as separate pages

### What was measured, and what it ruled out

The first plan here was "extract the shared CSS." That was wrong, and the
measurement says so plainly:

```
14 faq views, every one with a DIFFERENT css hash
1,272 distinct css lines across them
        3 appear in all 14 pages
    1,192 appear in 2 pages or fewer
  404 distinct class names, essentially no overlap
```

**There was no shared stylesheet to extract.** Extraction assumes commonality;
these pages had none. Three lines out of 1,272 is not a design system.

Templating them into one component was ruled out for the opposite reason:
sections run 3 → 10 and pages run 331 → 999 lines. A schema wide enough to
express all 28 would *be* the page, with worse ergonomics than JSX.

### What was done instead

`components/faq-theme.tsx` — a **canonical vocabulary**, not an extraction. It
deliberately mirrors `vs-competitor-view.tsx`: same palette, same section
rhythm, same card and table treatment, so a reader moving between
`/vs/readymode` and `/faq/leads` sees one product.

Each page keeps its own JSX and its own structure. The theme supplies the chrome
those elements are painted with. One file to edit for a redesign; no schema to
fight.

### The vocabulary

| Class | Use |
|---|---|
| `.faq-root` | article column (820px — narrower than `/vs`, this is prose) |
| `.faq-eyebrow` `.faq-h1` `.faq-deck` | page header |
| `.faq-section` `.faq-section-eyebrow` `.faq-h2` `.faq-h3` `.faq-p` | body |
| `.faq-list` | bulleted list |
| `.faq-card` `.faq-card-title` `.faq-grid` | cards |
| `.faq-callout` + `.warn` `.good` `.bad` | asides; the left border carries the tone |
| `.faq-table` | real `<table>` — identical treatment to `.feature-table` on `/vs` |
| `.faq-fieldtable` `.faq-fieldrow` `.faq-fieldcell` + `.head` `.name` | label/value grid that stacks on mobile |
| `.faq-flow` `.faq-flow-step` `.faq-flow-title` `.faq-flow-body` | auto-numbered steps |
| `.faq-badge` `.faq-badge-row` + `.hi` | inline tags |
| `.faq-cta` `.faq-cta-eyebrow` `.faq-cta-h` `.faq-cta-btn` | closing CTA |
| `.faq-related` `.faq-related-label` `.faq-related-links` | footer links |

### Migration recipe — per page, about ten minutes

`app/faq/leads/view.tsx` is the **reference implementation**. It went 395 → 264
lines. Read it before doing another.

1. List the page's own classes:
   `grep -o 'className="[^"]*"' view.tsx | sed 's/className="//;s/"//' | tr ' ' '
' | sort -u`
2. Map its private prefix onto the vocabulary above. `leads` used `.lead-*`;
   others use `.mob-*`, `.wl-*` and so on. **Rename longest names first** —
   replacing `lead-flow` before `lead-flow-step` corrupts the longer one.
3. Delete the page's `<style>` block; render `<FaqTheme />` in its place.
4. Import: `import FaqTheme from '@/components/faq-theme'`
5. Anything with no home in the vocabulary is either genuinely unique — leave it
   in the page — or a gap worth **adding to the theme**, if a second page will
   want it. Prefer adding; that is how the vocabulary earns its keep.
6. Check nothing is orphaned: `grep -c 'lead-' view.tsx` must be `0`.

### Status: 1 of 14 migrated

Done: `leads`.

Remaining: `billing`, `campaigns`, `compliance-export`, `data-and-recordings`,
`dialerseat-teams`, `manager-plus`, `managers`, `mobile`, `numbers`, `scripts`,
`white-label`, `white-label-mobile`, `why-dialerseat`.

`dialerseat-teams` (999 lines, 10 sections) is the hardest and should be done
**last**, once the vocabulary has been stretched by the easy ones. The other 14
`/faq` routes have no `view.tsx` at all and need nothing.

---

## Outstanding

### 1. `hookedcrm` is still bespoke — and cannot be migrated yet

`app/vs/hookedcrm/view.tsx` still exists, 23 feature rows, because
**`hookedcrm` has no record in `lib/competitors.ts`.** Migrating it as-is would
make `competitorBySlug('hookedcrm')` return null, hit `notFound()`, and 404 a
live indexed page.

To finish it, someone has to write a `Competitor` record: `pricing`, `contract`,
`dialing`, `wins[]`, `friction[]`, `bestFor`, `team{}`, `segment`. The facts are
already researched and sitting in the bespoke `view.tsx` — **move them from
there, don't rewrite them from memory.** These are claims about another
company's product and they were checked once.

Its matrix is already extracted and waiting in `COMPETITOR_FEATURES.hookedcrm`,
so the moment the record exists the migration is the same mechanical edit as
the other fourteen.

### 2. `/vs/everyone` and `/vs/teams` stay bespoke on purpose

Neither is a competitor page. `everyone` is the overview; `teams` is a
cross-vendor five-seat cost comparison rendering from the whole `COMPETITORS`
array. They have no slug of their own and should not gain one.

---

## Verifying a change

`npx next build` will fail locally with `supabaseUrl is required` unless the
Supabase env vars are present — that failure is environmental and unrelated to
these pages. `✓ Compiled successfully` plus `Finished TypeScript` above it is
the signal that matters.

For the data path specifically, the check worth re-running is: **every slug
under `app/vs/` that uses `competitorBySlug` must resolve.** A missing record
does not fail the build — it 404s at runtime, silently, on a page that ranks.
That is the failure mode this whole area is most exposed to.
