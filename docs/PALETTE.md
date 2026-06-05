# DialerSeat — Pass 1 Canonical Palette

This is the locked color and typography spec for the base DialerSeat product.

**Status pills, disposition buttons, and chart semantic colors are GLOBAL** — they encode meaning (success / danger / appointment / etc) and never change per whitelabel.

**`var(--brand-primary)` and all `--brand-*` tokens are whitelabel-controlled** — owned by the Pass 2 rebuild. In Pass 1 they were left untouched; the fallback is `#4a9eff`.

---

## Palette tokens (10)

| Token       | Hex      | Purpose                                              |
|-------------|----------|------------------------------------------------------|
| `T.bg`      | `#f0f1f4`| Page background                                      |
| `T.surface` | `#e2e4ea`| Cards, panels, inset boxes                           |
| `T.border`  | `#c4c8d0`| All 1px borders                                      |
| `T.dark`    | `#1a1a2e`| Dark header strip bg, primary button bg              |
| `T.text`    | `#1a1c24`| Body / primary text                                  |
| `T.muted`   | `#5a5e6a`| Secondary text, "▸ FOO" small caps labels            |
| `T.accent`  | `#2a4a8a`| Phone numbers, focus borders, info-bar left strips   |
| `T.green`   | `#1a6a1a`| Success, CLOSED (button-color variant `#2d7a2d`)     |
| `T.red`     | `#8a1a1a`| Danger, TERMINATE, DO NOT CALL                       |
| `T.amber`   | `#8a6a1a`| Warning, YIELD, NOT INTERESTED (bright `#ffaa3e`)    |

---

## Typography

```js
const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`
```

| Use case        | Font       | Style                                                |
|-----------------|------------|------------------------------------------------------|
| UI labels       | Futura     | Uppercase, 2–4px letter-spacing for small labels     |
| Button text     | Futura     | Uppercase, letter-spaced                             |
| Hero titles     | Futura     | Larger letter-spacing                                |
| Data values     | monospace  | Phone numbers, IDs, times, durations, counts         |
| Body prose      | system-ui  | Notes, descriptions, long-form readable text         |

---

## Page root pattern

```js
fontFamily: FUTURA
color: T.text
background: T.bg
minHeight: '100vh'  // NOT calc(100vh - 64px) — avoids dark strip at page bottom
```

The dark strip at page bottom is caused by `app/dashboard/layout.tsx`'s `<main>` defaulting to `var(--background)` (which resolves dark). The per-page `minHeight: 100vh` workaround masks it. The layout-level fix belongs in Pass 2.

---

## Header strip (top of every page)

```js
background: T.dark
borderBottom: 2px solid T.accent
padding: '10px 20px'
```

- Title: Futura, `letter-spacing: 4px`, `color: var(--brand-primary)`
- Subtitle / stats on the right: `monospace`, `color: #8888aa`, `letter-spacing: 2px`

---

## Primary button (canonical "go" CTA)

```js
background: T.dark
borderTop: '3px solid var(--brand-primary)'   // the colored stripe is the signature
border: 'none'                                // on sides/bottom
color: 'var(--brand-primary)'
fontFamily: FUTURA
fontSize: 12, fontWeight: 'bold', letterSpacing: 4
padding: 14
```

## Outlined button (secondary CTAs, RESUBSCRIBE banners, lapsed states)

```js
background: 'transparent'
border: '1px solid <accent color, usually T.amber for resubscribe>'
borderTop: '3px solid <same color>'
color: '<same color>'
fontFamily: FUTURA  // uppercase, letter-spaced
```

---

## Status pills — GLOBAL (never whitelabeled)

| Flavor   | Background | Accent / Text                       |
|----------|------------|-------------------------------------|
| Success  | `#e8f5e8`  | `T.green` (`#1a6a1a`)               |
| Info     | `#e8eef8`  | `T.accent` (`#1a4a8a`)              |
| Warn     | `#f8f4e8`  | `T.amber` (banner variant `#fdf4e8`)|
| Danger   | `#f8e8e8`  | `T.red` (`#8a1a1a`)                 |
| Neutral  | `#f0f0f4`  | `T.muted` (`#5a5e6a`)               |

All: `borderTop: 3px solid <accent>`, uppercase Futura label, letter-spaced.

## Disposition buttons — GLOBAL (never whitelabeled)

| Disposition      | Text Color | Background  |
|------------------|------------|-------------|
| CLOSED           | `#2d7a2d`  | `#e8f5e8`   |
| APPOINTMENT      | `#1a4a8a`  | `#e8eef8`   |
| NOT INTERESTED   | `#8a6a1a`  | `#f8f4e8`   |
| DO NOT CALL      | `#8a1a1a`  | `#f8e8e8`   |
| SKIP             | `#5a5e6a`  | `#f0f0f4`   |

---

## Card / panel pattern

```js
background: T.surface
border: '1px solid T.border'
borderRadius: 4
padding: '10–14px'

// Optional accents:
borderLeft: '3px solid <semantic color>'   // info / context bar
borderTop:  '3px solid <semantic color>'   // "primary card" treatment
```

## Banner pattern (page-top alerts, lapsed strips)

```js
padding: '8–10px 20px'
background: '<pill background matching severity>'
borderBottom: '2px solid <matching accent color>'
color: '<matching accent color>'
fontSize: 11, letterSpacing: 1, fontWeight: 'bold'
textAlign: 'center'
// Prefix ⚠ for warnings
```

---

## PWA / iOS specifics

```js
// Fullscreen fixed overlays (e.g. dialer manual-dial zoomed overlay):
paddingTop: 'env(safe-area-inset-top)'
background: T.dark   // so the safe-area strip reads as continuation, not light gap

// Scrollable content with bottom buttons:
paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))'
```

---

## What is NOT in Pass 1 (owned by Pass 2)

- `var(--brand-primary)` and all `--brand-*` tokens — Pass 2 whitelabel rebuild
- `<main>` element default bg in `app/dashboard/layout.tsx` (currently resolves dark, masked by per-page `minHeight: 100vh`)
- The current whitelabel CSS variable system — gets deleted and rebuilt in Pass 2
- New presets: **light gray / light purple**, **forest green**, **light pink / light brown** — Pass 2 defines exact hex values
- Live exact-preview onboarding flow — Pass 2
- Sidebar bg as a separate whitelabel slot (distinct from primary) — Pass 2
- KPI tile accent stripe behavior (whitelabel-bound vs semantic) — TBD in Pass 2
- 60-second site-wide propagation disclaimer on onboarding — Pass 2