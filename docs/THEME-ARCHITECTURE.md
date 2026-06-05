# DialerSeat — Theme Architecture (Pass 2)

Companion to `PALETTE.md`. PALETTE.md defines the locked Pass 1 base product palette. THIS doc defines the whitelabel layer on top — what tenants can customize, how it propagates, how the rebuild is structured.

**Status:** spec, not yet built. JC reviews and approves before implementation begins.

---

## Principles

1. **Two-tier color model.** Global semantic colors (status, dispositions, page chrome) are FIXED. Brand colors (sidebar + primary) are TENANT-CONTROLLED. Nothing in between.
2. **Simple input, deep output.** User picks 2 colors. System derives 6+ supporting tokens. Three curated presets + custom.
3. **One source of truth.** A tenant picks ONE theme. Every whitelabel-eligible element across every page binds to that ONE theme. No per-page color choices.
4. **Live exact preview, not mockup.** The onboarding preview renders the same components the real dashboard renders, themed identically.
5. **Settings is editable onboarding.** The settings page mirrors the onboarding theme picker, providing ongoing customization without leaving the dashboard.

---

## Color model (3 tiers of CSS variables)

### Tier 1 — User-picked (whitelabel-controlled, stored in DB)

| Variable               | Purpose                                                              |
|------------------------|----------------------------------------------------------------------|
| `--brand-primary`      | Brand accent: CTAs, focus rings, active states, header top accent line, chart data series, KPI tile inner color (NOT the stripe — see §KPI), "MANAGER+" pill bg, segmented control active bg, "AWAITING DATA" overlay pill bg |
| `--brand-sidebar-bg`   | Sidebar strip background AND header strip background AND primary button background — all unified as "the dark surface". Replaces hardcoded `T.dark = #1a1a2e` in sidebar/header contexts |

### Tier 2 — Derived from Tier 1 (computed by ThemeProvider at runtime)

| Variable                       | Derivation                                                                |
|--------------------------------|---------------------------------------------------------------------------|
| `--brand-on-primary`           | `pickContrastText(primary)` — `#ffffff` or `#1a1c24` based on luminance   |
| `--brand-primary-hover`        | `color-mix(in srgb, var(--brand-primary) 88%, black)`                     |
| `--brand-primary-soft`         | `color-mix(in srgb, var(--brand-primary) 12%, transparent)`               |
| `--brand-on-sidebar`           | `pickContrastText(sidebarBg)`                                             |
| `--brand-on-sidebar-muted`     | If on-sidebar = #fff: `rgba(255,255,255,0.55)`; else: `rgba(26,28,36,0.55)` |
| `--brand-sidebar-active-bg`    | If on-sidebar = #fff: `rgba(255,255,255,0.08)`; else: `rgba(0,0,0,0.06)`  |
| `--brand-sidebar-hover-bg`     | Half opacity of `--brand-sidebar-active-bg`                               |
| `--brand-header-top-accent`    | `var(--brand-primary)` — the 2px line under the header strip              |

### Tier 3 — Fixed global tokens (NEVER themed, defined in `globals.css`)

#### Page chrome

| Variable          | Hex      | Purpose                              |
|-------------------|----------|--------------------------------------|
| `--page-bg`       | `#f0f1f4`| Page background                      |
| `--card-surface`  | `#e2e4ea`| Cards, panels, KPI tile bg           |
| `--card-border`   | `#c4c8d0`| All 1px borders                      |
| `--body-text`     | `#1a1c24`| Body / primary text                  |
| `--muted-text`    | `#5a5e6a`| Secondary text, small caps labels    |

#### Status (semantic, never themed)

| Variable                  | Hex      |
|---------------------------|----------|
| `--status-success`        | `#1a6a1a`|
| `--status-success-bg`     | `#e8f5e8`|
| `--status-warn`           | `#8a6a1a`|
| `--status-warn-bg`        | `#f8f4e8`|
| `--status-warn-banner-bg` | `#fdf4e8`|
| `--status-danger`         | `#8a1a1a`|
| `--status-danger-bg`      | `#f8e8e8`|
| `--status-info`           | `#2a4a8a`|
| `--status-info-bg`        | `#e8eef8`|
| `--status-neutral`        | `#5a5e6a`|
| `--status-neutral-bg`     | `#f0f0f4`|

#### Disposition (semantic, never themed)

| Variable                    | Hex      |
|-----------------------------|----------|
| `--disp-closed`             | `#2d7a2d`|
| `--disp-closed-bg`          | `#e8f5e8`|
| `--disp-appt`               | `#1a4a8a`|
| `--disp-appt-bg`            | `#e8eef8`|
| `--disp-not-interested`     | `#8a6a1a`|
| `--disp-not-interested-bg`  | `#f8f4e8`|
| `--disp-dnc`                | `#8a1a1a`|
| `--disp-dnc-bg`             | `#f8e8e8`|
| `--disp-skip`               | `#5a5e6a`|
| `--disp-skip-bg`            | `#f0f0f4`|

---

## KPI tile stripes — recommendation: stay semantic

Screenshot annotation flagged these as whitelabel targets. I recommend keeping them **semantic** (Tier 3), not themed:

- Each stripe encodes the metric's nature (green = conversions/closed = positive outcome; blue = hours/info; amber = best campaign = highlight). Themeing them collapses six visual roles into one color.
- The brand primary already appears in 12+ other places on the page (sidebar logo box accent, header top line, AWAITING DATA pill, chart line, MANAGER+ pill, segmented active state, KPI tile counter numerals where applicable, every CTA button, focus rings, etc). Brand identity is not weakened by keeping these semantic.
- Consistent with the same rule we already apply to status pills and disposition buttons — semantic colors are global.

**If you disagree:** flip the spec — KPI stripes bind to `--brand-primary`. One-line change. Say the word.

---

## Database schema migration

### Current `white_label_tenants` columns (color-related)

```
primary_color text
secondary_color text
accent_color text     -- semantically used as "sidebar/surface"
background_color text
text_color text
```

### Target schema (Pass 2)

```
primary_color text NOT NULL DEFAULT '#4a9eff'
sidebar_color text NOT NULL DEFAULT '#1a1a2e'
```

### Migration SQL

```sql
BEGIN;

-- 1. Add new sidebar_color, backfill from existing accent_color
ALTER TABLE white_label_tenants
  ADD COLUMN sidebar_color text;

UPDATE white_label_tenants
  SET sidebar_color = COALESCE(accent_color, '#1a1a2e');

ALTER TABLE white_label_tenants
  ALTER COLUMN sidebar_color SET DEFAULT '#1a1a2e',
  ALTER COLUMN sidebar_color SET NOT NULL;

-- 2. Ensure primary_color has the default
ALTER TABLE white_label_tenants
  ALTER COLUMN primary_color SET DEFAULT '#4a9eff';

-- 3. Drop the four columns we no longer need
ALTER TABLE white_label_tenants
  DROP COLUMN secondary_color,
  DROP COLUMN accent_color,
  DROP COLUMN background_color,
  DROP COLUMN text_color;

COMMIT;
```

Existing tenants (your `demo` row) get backfilled: their old `accent_color` becomes their new `sidebar_color`. Their `primary_color` is preserved. The other 3 columns drop their data.

---

## ThemeProvider v2 contract

### Input

```typescript
interface TenantBranding {
  primary_color: string    // #RRGGBB
  sidebar_color: string    // #RRGGBB
  // ... non-color tenant fields (brand_name, logo_url, etc.) unchanged
}
```

### Output (injected via SSR `<style>` to avoid FOUC)

```css
:root {
  /* Tier 1 — direct from DB */
  --brand-primary:           #<primary>;
  --brand-sidebar-bg:        #<sidebar>;

  /* Tier 2 — derived */
  --brand-on-primary:        <contrast pick>;
  --brand-primary-hover:     color-mix(in srgb, var(--brand-primary) 88%, black);
  --brand-primary-soft:      color-mix(in srgb, var(--brand-primary) 12%, transparent);
  --brand-on-sidebar:        <contrast pick>;
  --brand-on-sidebar-muted:  <rgba muted variant>;
  --brand-sidebar-active-bg: <rgba overlay>;
  --brand-sidebar-hover-bg:  <rgba overlay, half opacity of active>;
  --brand-header-top-accent: var(--brand-primary);
}
```

### `pickContrastText(hex)` (already exists, keep)

```typescript
function pickContrastText(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '#ffffff'
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return luminance > 0.55 ? '#1a1c24' : '#ffffff'
}
```

### Provider lifecycle

- SSR render: inject `<style>` block as first child of `<body>` so brand colors apply before any client JS hydrates.
- Hydration: ThemeProvider re-injects (idempotent) and exposes branding via React context for components that need direct programmatic access (rare — most just use CSS vars).
- Theme change: when settings page POSTs a new theme, ThemeProvider re-runs derivation. CSS vars update. Page re-paints. No reload required for the local user (CDN propagation for OTHER users takes up to 60 seconds — disclosed on onboarding).

---

## Presets (3, exact hex)

### Preset 1 — `stone-lavender` ("Stone & Lavender")

```
sidebar_color: #4a4a55   /* warm slate, distinct against light page bg */
primary_color: #b8a3e0   /* soft lavender */
```

Light, calm, professional. Sidebar text auto-resolves to white (luminance < threshold). Primary text resolves to dark (#1a1c24).

### Preset 2 — `forest` ("Forest")

```
sidebar_color: #1a3a26   /* deep forest */
primary_color: #5fb87a   /* bright leaf green */
```

Earthy, confident. Sidebar text white. Primary text dark.

### Preset 3 — `bloom` ("Bloom")

```
sidebar_color: #6e5142   /* warm brown */
primary_color: #e8b8c5   /* rose pink */
```

Soft, distinctive. Sidebar text white. Primary text dark.

### Custom

User picks both colors freely via color pickers + hex inputs. Live preview updates as they pick.

### Default for new tenants

`stone-lavender` is the initial selected state in onboarding. Tenant must confirm or change before saving.

---

## Onboarding flow (`/onboarding/whitelabel`)

Single page. Five sections in order:

1. **Brand name** (text input, 2–60 chars)
2. **Subdomain** (text input, slug regex, live availability check, 24h cooldown if editing)
3. **Logo** (file upload, 512×148 PNG/SVG, max 200 KB)
   - Preview box: `padding: 0`, exactly 256×74, `objectFit: contain`, `objectPosition: center` — fills the entire box when the source is at the recommended aspect ratio.
4. **Theme** (3 preset cards + "Custom" card)
   - Each preset card shows a 2-swatch row (sidebar swatch + primary swatch) + name.
   - Selecting a preset applies its 2 colors. Selecting "Custom" reveals the picker rows.
   - Custom picker: 2 color rows (Sidebar, Primary). Each row = swatch input + label + hex input.
5. **Live exact preview** — the big addition (see §Live preview)
6. **Disclaimer** — see §Disclaimer
7. **Confirm button** (renders in selected primary color with `--brand-on-primary` text)

### Live preview

A self-contained component that renders inside the onboarding card, themed live by the same CSS vars the real dashboard will use.

Components rendered inside the preview:
- Mini sidebar strip (~140px wide, full preview height): logo box + 3 nav items (one active) + small "MANAGER+" pill at bottom
- Mini header strip (top of right area): title text + a sample segmented control with one active button
- Page area: one KPI tile (with semantic stripe — recommendation), one "AWAITING DATA" pill, one primary button labeled "CONFIRM"

Bound to `--brand-primary`, `--brand-sidebar-bg`, and all Tier 2 derived tokens. As the user changes preset or custom colors, the preview re-paints in real time. The result they see in the preview is byte-for-byte what the real dashboard will look like.

Implementation note: the preview component should import the same primitives the real sidebar and header use, not maintain its own copies. That's how we guarantee "exact" — not "approximately like".

### Disclaimer

Placed immediately above the Confirm button:

> ⓘ **Heads up:** color and logo changes propagate site-wide within 60 seconds. Your own browser updates instantly on save. Other users (your team, your customers) will see the new look after their next page load, up to a minute later.

Style: card-surface bg, 3px left border in `--status-info`, `--status-info` text color, body-text-sized.

---

## Settings page reflection (`/dashboard/settings`)

The settings page contains a **Theme** section that mirrors the onboarding theme picker. Same 3 presets, same custom picker, same live preview, same disclaimer.

When the user saves on settings:
- Same API endpoint as onboarding (`POST /api/whitelabel/onboarding`)
- Same revalidation logic
- User stays on settings (no redirect)
- Toast confirms save: "Theme updated. Propagating now — up to 60 seconds for everyone else."

The settings page itself is themed via the same CSS vars, so it visually reflects the current theme even before the user changes anything. Choosing a new preset previews the new theme on the settings page itself in real time — they can see exactly what the settings page (and everything else) will look like.

---

## Page-by-page binding map

Every Pass 1 page needs its whitelabel-eligible elements switched from hardcoded values (or `--brand-*` legacy) to the new Tier 1 + Tier 2 tokens. The full sweep:

### Sidebar (`app/dashboard/layout.tsx`)

| Element                     | Pass 1 value              | Pass 2 binding                        |
|-----------------------------|---------------------------|---------------------------------------|
| Sidebar strip bg            | `#1a1a2e` hardcoded       | `var(--brand-sidebar-bg)`             |
| Logo box bg                 | `#1a1a2e` or lighter      | `var(--brand-sidebar-bg)` (or derived lighter) |
| Logo box padding            | non-zero                  | `0` — logo fills entire box           |
| Nav item text (inactive)    | light gray hardcoded      | `var(--brand-on-sidebar-muted)`       |
| Nav item text (active)      | white hardcoded           | `var(--brand-on-sidebar)`             |
| Nav item active band bg     | hardcoded gray            | `var(--brand-sidebar-active-bg)`      |
| Nav item active band border | hardcoded gray            | `var(--brand-sidebar-active-bg)`      |
| Nav item hover bg           | hardcoded                 | `var(--brand-sidebar-hover-bg)`       |
| MANAGER+ pill bg            | brand color               | `var(--brand-primary)`                |
| MANAGER+ pill text          | white                     | `var(--brand-on-primary)`             |

### Header strip (every page)

| Element                  | Pass 1 value              | Pass 2 binding                  |
|--------------------------|---------------------------|---------------------------------|
| Header strip bg          | `T.dark` (#1a1a2e)        | `var(--brand-sidebar-bg)`       |
| Header title text        | `var(--brand-primary)`    | `var(--brand-primary)` (no change) |
| Header subtitle / stats  | `#8888aa`                 | `var(--brand-on-sidebar-muted)` |
| 2px top accent line      | `T.accent` (#2a4a8a)      | `var(--brand-header-top-accent)` = `var(--brand-primary)` |
| LANDING PAGE button bg   | hardcoded                 | `var(--brand-primary)`          |
| LANDING PAGE button text | white                     | `var(--brand-on-primary)`       |

### Buttons (all pages)

| Button type                            | Pass 1                                 | Pass 2                                                                                 |
|----------------------------------------|----------------------------------------|----------------------------------------------------------------------------------------|
| Primary CTA (INITIATE DIAL, CONFIRM)   | `bg: T.dark, borderTop: var(--brand-primary), color: var(--brand-primary)` | `bg: var(--brand-sidebar-bg), borderTop: var(--brand-primary), color: var(--brand-primary)` |
| Outlined secondary                     | transparent + colored border           | unchanged (uses status colors)                                                         |
| Status pills, disposition buttons      | hardcoded semantic                     | **stays Tier 3, never themed**                                                          |

### Analytics page

| Element                       | Pass 2 binding                                  |
|-------------------------------|-------------------------------------------------|
| Segmented control active bg   | `var(--brand-primary)`                          |
| Segmented control active text | `var(--brand-on-primary)`                       |
| KPI tile stripe (each)        | **stays semantic** (recommendation) — see §KPI |
| KPI tile counter color        | `var(--brand-primary)` for "primary metric" tiles; semantic for others |
| Chart data series color       | `var(--brand-primary)`                          |
| "AWAITING DATA" pill bg       | `var(--brand-primary)`                          |
| "AWAITING DATA" pill text     | `var(--brand-on-primary)`                       |

### Other pages

Campaigns, Recordings, Leads, Teams, Dialer, Settings — all follow the same primary/sidebar binding rules. Specific element audits happen during Phase C (page-by-page sweep).

---

## What gets deleted

- 6 existing presets in onboarding (`default`, `midnight`, `crimson`, `forest`, `slate`, `sunrise`)
- 3 unused CSS var injections (`--brand-secondary`, `--brand-bg`, `--brand-text`)
- 3 DB columns (`secondary_color`, `background_color`, `text_color`)
- The `secondary_color`, `background_color`, `text_color` fields from the onboarding form
- The `Secondary`, `Background`, `Text` rows from the custom color picker
- The 5-color preset cards (replaced by 2-color preset cards)
- The current "PREVIEW (256×74 — your sidebar block)" mockup (replaced by the new full Live Exact Preview)

---

## Rollout phases

Phase A — Architecture (this doc).
Status: ready for your review.

Phase B — Foundation rebuild. One push per item:
- B1: DB migration SQL (delivered as a `.sql` file you run against Supabase)
- B2: New `ThemeProvider` v2 component
- B3: New `globals.css` with the Tier 3 fixed tokens
- B4: New onboarding page `app/onboarding/whitelabel/page.tsx`
- B5: New `POST /api/whitelabel/onboarding` handling 2 colors (removes the 3 old hex validations)
- B6: New `app/dashboard/settings/page.tsx` (theme section + live preview)
- B7: New Live Exact Preview component (shared between onboarding and settings)

Phase C — Page-by-page rebinding sweep. One page per push:
- C1: `app/dashboard/layout.tsx` (sidebar — the most visible)
- C2: Analytics
- C3: Campaigns
- C4: Recordings
- C5: Leads
- C6: Teams
- C7: Dialer

Phase D — Cleanup:
- D1: Drop any remaining legacy `--brand-secondary` / `--brand-bg` / `--brand-text` references in unused code
- D2: Smoke test all 3 presets end-to-end on the demo tenant
- D3: Document for future agents/onboarding flows

---

## Files I'll still need before Phase B starts

- `app/layout.tsx` (root) — to confirm where ThemeProvider mounts in v2
- `app/dashboard/settings/page.tsx` — to know what currently lives there (settings might be empty or have other content I shouldn't trample)
- `app/globals.css` (or whatever the CSS entry is) — to see current Tier 3 / status / etc. definitions

Optional, helpful but not blocking:
- `app/api/whitelabel/upload-logo/route.ts` — only changes if we tighten aspect/size validation
- `middleware.ts` or `proxy.ts` — unchanged in Pass 2 unless hard-lock allowlist needs an update

---

## Open items for JC

1. **KPI tile stripes** — accept the "stay semantic" recommendation, or override to "theme-bound"?
2. **Preset names + hex** — Stone & Lavender / Forest / Bloom — approve, tweak the hex, or rename?
3. **Settings page mirror scope** — full live preview + custom picker, same as onboarding? Or smaller (e.g. preset selector only, no custom)?
4. **Initial selected preset on new onboarding** — Stone & Lavender, or a different default?
5. **Sign-off to start Phase B** once items 1–4 are answered.