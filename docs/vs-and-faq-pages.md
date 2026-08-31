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

## The design source is the landing page

`lib/siteTheme.ts` holds the tokens, and every value in it was **read out of
`app/page.tsx`** rather than invented. Both article templates import from it, so
there is one place to change a colour.

### The drift it fixed, which was not subtle

The landing page is **light** — `#f0f1f4` ground, near-black type. `/vs` and
`/faq` were built **dark** — `#0a0a14` with white type. Not a different accent
or a looser grid: the inverse. A visitor going from the homepage to
`/vs/readymode` was not moving through one site, and matching the spacing would
never have hidden that.

The only thing already shared was the accent blue, `#4a9eff`, on both sides.

### The two conventions worth keeping

**Two-tone headlines.** The landing page sets "DIAL SMARTER." in near-black over
"CLOSE FASTER." in deep blue (`SITE.deep`). Wrap the second half in
`<span class="alt">` (`.versus` on `/vs`). This is the site's signature move and
the main reason the homepage reads as designed rather than assembled.

**The button.** 1px border all round, **3px on top**, 6px radius, transparent
fill. It reads as a physical key. Any button that omits the top edge looks like
it came from a different product.

### Tokens

| Token | Value | Use |
|---|---|---|
| `bg` | `#f0f1f4` | page ground |
| `surface` | `#ffffff` | cards, panels |
| `border` / `borderSoft` | `#c4c8d0` / `#e2e4ea` | containers / dividers |
| `text` / `muted` | `#1a1c24` / `#5a5e6a` | type |
| `blue` / `deep` | `#4a9eff` / `#2a4a8a` | accent / headline second tone |
| `ink` / `inkText` | `#0e0e16` / `#fff` | dark panels inside a light page |
| `amber` `green` `red` | | caution / good / bad |

`ink` is the exception that makes the light ground read as chosen: the landing
page uses it for the stat bar under the hero, and the article templates use it
for table headers and the closing CTA. Used sparingly on purpose.

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

### Status: all 14 migrated

Every `/faq` page renders `<FaqTheme />` and none carries a private palette.
The batch went **6,014 lines to 4,840**, with roughly 450 duplicated CSS rules
removed. The other 14 `/faq` routes have no `view.tsx` and need nothing.

### If you migrate another page later

The script lives in the scratchpad and is disposable, but **the lesson it
encodes is not**: make it *report every rule it drops*. Silent dropping is how
this loses content, and three separate classes of breakage were caught only by
reading those reports:

1. **Bare elements.** These pages write `<h2>`, `<p>`, `<li>`, `<code>` directly
   and almost never a `className` — `campaigns` has nine `<p>` and zero
   `.faq-p`. The theme therefore styles elements *inside* `.faq-section`, not
   just classes. If you add a page, write prose with bare tags; that is the
   supported path.
2. **Nested prose.** `.faq-section p.muted`, `.faq-flow-body p` and `.faq-cta p`
   each carried real styling. Losing them does not error — the paragraphs just
   inherit body colour and quietly lose their hierarchy.
3. **One-page classes.** `.faq-section.alt`, `.faq-section-label`,
   `.faq-badge.price`. Recover the original rule from git rather than guessing
   at what it looked like.

Two known-dead things, both pre-existing: an unescaped apostrophe in
`data-and-recordings` that lint already flagged, and `.left` / `.right` on the
mobile carousel arrows, which never had rules in the first place.

### The accent-word convention

`<em>` inside an `.faq-h1` renders **deep blue, not italic**. That is how these
pages have always marked an accent word, and it maps exactly onto the landing
page's two-tone headline — so the signature arrives without touching markup.

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
