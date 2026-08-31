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

## Why `/faq` is different

It is tempting to do to `/faq` what was done to `/vs`. Don't. Here is the
measurement that settles it:

```
all 14 faq/*/view.tsx have DIFFERENT css hashes
sections per page:  3 → 10
lines per page:     331 → 999
```

Compare that with `/vs` before migration: 15 files, 8 of them **byte-identical**
CSS, all ~490 lines, differing only in strings. That is fifteen copies of one
page. `/faq` is 28 genuinely different pages that happen to share a visual
language.

Forcing them into one component means either inventing a schema wide enough to
express all 28 (at which point the schema is the page, with worse ergonomics),
or deleting the sections that don't fit. Both are worse than what is there now.

### So what IS the win for `/faq`

**Extract the design system, not the layout.** Every page redefines the same
palette and the same base rules in its own `<style>` block. Pull those into one
place and a redesign becomes one edit, while each page keeps the structure its
content actually needs.

Suggested order:

1. Create `app/faq/faq-theme.css` (or a shared `<FaqShell>` that renders the
   common `<style>`) holding the palette, type scale, spacing, and the shared
   `.faq-*` classes
2. Migrate pages onto it **one at a time**, deleting only the rules that moved
3. Leave each page's genuinely unique CSS in the page

That gets the redesign leverage without the content loss.

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
