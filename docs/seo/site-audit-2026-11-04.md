# DialerSeat SEO audit against the RankHonestly book — 4 Nov 2026

Measured on the live site, not the repo: all 147 English URLs in the sitemap were fetched and parsed, a sample was loaded in a real browser, and the first-party `page_views` table was queried. Chapter references are to the book notes in [rankhonestly-book-notes.md](rankhonestly-book-notes.md); the checklist used is chapter 38's.

Not measured: Google Search Console data (no access from here; needed for the position and CTR work in ch 16, 17 and 23 and Appendix D), real-user Core Web Vitals (no field data is collected), and click or dead-click behaviour (no instrument for it).

---

## Where the site stands

| | |
|---|---|
| Public English pages | 147 (1,720 URLs across 12 languages) |
| Anonymous page views since tracking began (24 Aug) | 1,850, about 26 a day |
| Search-engine referrals | 228 Google, 13 Bing, 7 Brave, 4 DuckDuckGo |
| Weekly search referrals | 4 → 6 → 12 → 30 → 25 → 20 → 13 → 10 → 46 → 55 → 32 (part week) |
| AI-assistant referrals | 0 |
| Social referrals | 232, almost all Instagram |
| Top non-brand search landing page | /vs/dialer-io (24 visits) |
| Brand-navigation landings from search | / 63, /sign-in 26, /sign-up 17 — about 46% of search visits |

By the book's own clock (ch 2, 14, 32), the site is inside the window where traffic can't tell a working strategy from a failing one. Most SEO pages shipped 25–26 Sept, so **don't judge the strategy before about late January 2027.** At ~26 views a day, compare nothing shorter than 28 days (ch 15). The upward trend in search referrals is the right shape, but it's too small to read yet.

---

## Findings, most severe first

### 1. `https://www.dialerseat.com` shows a certificate error — HIGH
The www hostname is a CNAME to `cname.vercel-dns.com`, so DNS is right, but the certificate Vercel serves for it covers only `dialerseat.com`: www isn't added to the project as a domain. Anyone who types `www.dialerseat.com`, or clicks a link someone wrote that way, gets a browser security warning instead of a redirect. `http://www.` redirects to `https://www.`, which then fails.
- Book: ch 10 / ch 38 Layer 1 — one hostname, the other 301s to it. A certificate failure is the "cliff, not slope" kind of fault in ch 14 and ch 22.
- Fix: Vercel → Project → Settings → Domains → add `www.dialerseat.com`, set to redirect (308) to `dialerseat.com`. Vercel issues the certificate itself; no DNS change is needed.

### 2. FAQ structured data the reader can't see — HIGH
112 English pages carry FAQPage markup. On **92 of them, none of the marked-up questions appear on the page**: 63 `/vs` pages, 16 `/data` pages, 11 `/faq` pages, /partners and /screenshots. Verified in a real browser on /vs/phoneburner, /faq/why-calls-show-spam-likely and /data/calling-rules-by-country/us. The questions and answers exist only in the JSON-LD.
- Book: ch 8 and ch 38 — "every marked-up thing is visible on the page"; the most common and most penalised structured-data violation, and a manual-action risk to rich results across the whole site.
- FAQ rich results are now largely restricted to government and health sites anyway, so DialerSeat gains almost nothing from this markup and carries all of the risk.
- Fix, either: (a) render each page's FAQ visibly (a "Questions" section at the foot of the page, from the same data the JSON-LD is built from, so they can't drift apart — a UI addition, so your call on how it looks); or (b) stop emitting FAQPage on pages that don't show the questions. (b) is a code-only change and removes the risk today.
- Source: `lib/vsSeo.ts`, `app/components/StructuredData.tsx`, `lib/schema.ts`.

### 3. A false claim in the markup and the AI files: CNAM registration — HIGH (credibility)
`llms.txt`, `llms-full.txt`, the SoftwareApplication `featureList` on every page, `lib/canonicalFacts.ts`, and the hidden FAQ on /vs/phoneburner, /vs/readymode, /vs/five9 and /vs/everyone all say every number is registered for CNAM. Per the 25 Sept decision, CNAM was never set and won't be. /vs/everyone also says "full STIR/SHAKEN A-attestation" on all traffic, where every other page says "where supported".
- Book: ch 29 mistake 3 — a trust-selling product can't carry a checkable false claim; ch 13 — the llms files are what assistants learn the brand from, so a wrong sentence there gets repeated.
- Fix: remove the CNAM clause in those seven places and align /vs/everyone with "where supported". "FCR" is also claimed and wasn't verified in this audit; confirm or drop it at the same time.

### 4. The brand entity is empty: `sameAs: []`, no `alternateName` — HIGH (strategy)
The Organization schema lists no profiles and no alternate spellings. /vs/dialer-io is the top non-brand landing page from search, and assistants have shown dialer.io imagery for DialerSeat (commit fa23c8b69). That is the near-identical-name situation in ch 10 and ch 27, where the competitor won the brand query and the sitelinks at a fraction of the authority.
- Book: ch 9 entity checklist, ch 25 Tier 1 — Google Business Profile and Bing Places are "entity registrations, not links"; ch 27 — "they beat me because the engine is more confident they are the entity".
- Fix: create the company profiles already listed in `docs/VISIBILITY.md` §3 (LinkedIn company, Crunchbase, G2, Capterra, Product Hunt, YouTube), claim Google Business Profile and Bing Places, and add each URL to `sameAs` as it goes live. Add `alternateName` for every way people type it ("Dialer Seat", "dialerseat", "dialerseat.com"). Profiles need your accounts, so they're yours to create; the schema change is a minute's work once they exist.

### 5. Bing is close to silent — MEDIUM
13 Bing visits in ten weeks, against 228 from Google (5.7%); in the book's case Bing ran at 5–20% of Google. Weekly Bing counts are mostly zero, which at this volume can't separate a dead channel from noise (ch 15). DNS carries a Google verification record but no Bing one, so registration can't be confirmed from outside.
- Book: ch 22 — register Bing on day one; check each channel separately every week, looking for zeros.
- Fix: confirm the site is in Bing Webmaster Tools (importing from Search Console is fine), submit `sitemap.xml`, and run `scripts/indexnow-submit.mjs`.

### 6. Titles: the brand suffix pushes 89 of 147 over the limit — MEDIUM
138 page titles end in " | DialerSeat". 89 titles are over 60 characters and get cut off in results; with the suffix removed, only 22 are. The homepage title is right (it leads with the brand as people write it).
- Book: ch 7 Field 3 — under 60 characters, query first, don't repeat the brand on every page; the homepage carries the brand.
- Fix: drop the suffix on non-home pages (mechanical, no copy change). The 22 still over 60 would need shortening — that's wording, so it's your call: /vs 83, /vs/everyone 80, /faq/dialer-for-real-estate 70, /faq/dialer-for-debt-collection 69, /faq/dialer-for-b2b-sales 68, /vs/five9 68, and 16 more between 61 and 64.

### 7. Meta descriptions: 98 of 147 over 160 characters — MEDIUM
Longest: /partners 423, /faq/languages 322, /faq/white-label-mobile 282, /faq/dialerseat-teams 278, /faq/mobile 267. Everything past ~155 characters is cut mid-sentence in results.
- Book: ch 7 Field 4. Descriptions don't affect rank but drive click-through, which matters most at positions 6–10 (ch 7, Appendix D).
- Fix: rewrite to ≤155 characters. That's copy, so I'd draft and you'd approve.

### 8. The sitemap index submits 8 test tenants — LOW
`/sitemap-index.xml` lists the sitemaps for test1–test8.dialerseat.com. Each lists only `/`, `/sign-in` and `/sign-up`: the first redirects to sign-in, and the other two are disallowed by that tenant's own robots.txt. Their `lastmod` is the time of each request, which the code in the apex index specifically avoids.
- Fix: leave tenants out of the apex sitemap index (or include only tenants with a public landing page), and don't list robots-disallowed URLs in tenant sitemaps.

### 9. Country pages open with a description, not an answer — LOW
All 15 /data/calling-rules-by-country pages begin by describing the page ("What a caller has to do before dialing people in X…", 26 words). In the book's spec, the 40–80 words after the H1 answer the query outright, because that's the passage snippets and AI answers lift (ch 7 Field 1, ch 12). 85 of 147 pages have a first paragraph under 40 words. These pages are also short (365–475 words); depth gets a page onto page one (ch 38).
- Fix: a 40–80 word direct answer under each country H1 (DNC list, calling hours, consent rule, in one paragraph). Copy, so draft-and-approve.

### 10. Structured-data tidying — LOW
- Organization and SoftwareApplication are emitted twice on many pages (217 Organization blocks across 147 pages): once from the layout's `@graph` and again page-level, with the same `@id`. Google merges them, but `docs/VISIBILITY.md` says they were merged and they aren't.
- Organization appears on every page; the book puts it on the homepage only (ch 8). Harmless.
- Article blocks have `dateModified` but no `datePublished` or `image`.

---

## What already meets the book's checklist

- Every page serves finished HTML: title, description, H1, body and JSON-LD are in the served file (ch 11; the book's one "very high confidence" change).
- Titles survive page load (checked live on 5 pages — no "meta-clobber", Appendix C 6b).
- One hostname for content, absolute self-referencing canonicals on all 147 pages, no stray `noindex`.
- One H1 per page everywhere except /sign-up.
- Unique title and description on every page; no duplicates.
- A unique Open Graph image and a Twitter card on every page.
- No AggregateRating anywhere (ch 29's worst mistake avoided).
- No JSON-LD parse errors; every URL in it is absolute.
- Standalone BreadcrumbList on every page except / and /sign-up.
- 143 of 147 pages link to 3+ sibling pages inside body text (ch 7 Field 9).
- Real `lastmod` dates in the main sitemap; hreflang on all 12 languages with x-default.
- Robots.txt groups each carry the private-path list, and AI crawlers are allowed.
- The language preference cookie changes the language at an English URL for that visitor only; crawlers don't send it, so it doesn't affect indexing.

---

## Strategy: what the book says to do next

1. **Start the link work now, not later** (ch 29 mistake 1). The site is roughly in its third month; the book's largest single mistake was starting links in month seven. The plan already exists in `docs/VISIBILITY.md` §4. Book rhythm: 3–5 targeted emails a day plus 2–3 genuine community contributions a week, aiming for 20–30 referring domains a quarter. Expect about 2 links per 50 emails; judge results on an 8–12 week lag.
2. **Find the one interesting, checkable sentence** (ch 5, 24). The book's test: what does the incumbents' business model forbid? Weekly billing with no contract is that for DialerSeat: competitors' revenue model is annual or monthly commitments, and "a week costs $35, not a month" can be checked by anyone at checkout. `/data/connect-rates` (live platform data nobody else has) is the "original data" asset ch 24 says earns links. Lead every pitch with one of these, never the feature list.
3. **More free tools, each verified for demand first** (ch 6, 35, 37). Two tools exist. The book's model is many small, free, no-account pages, each doing one job a stranger searches for. Candidates to check in autocomplete before building: a "can I call this number right now" calling-hours checker by state, an area-code lookup for local presence, a phone-list formatter/cleaner for CSV uploads, an agents-needed / lines-per-agent calculator, and a "why does my number show Spam Likely" self-check. Keep only those whose phrasing autocomplete confirms (ch 1: if fewer than 10 of 20 phrases survive, don't build).
4. **Don't add languages** (ch 21). Twelve already ship. Translated pages are getting a little search traffic (/fr, /es, /de and /ja landings), so keep them, but the book says not to multiply pages across markets before authority exists in one.
5. **Set up the measurement the book relies on** (ch 13, 18, 33, Appendix D):
   - A weekly per-channel check (Google, Bing, social, AI, direct), looking for zeros.
   - A fixed set of ten buyer questions asked monthly to ChatGPT, Claude, Gemini, Perplexity and Copilot in fresh sessions; record whether DialerSeat is named and in what words.
   - A Search Console export (Queries.csv and Pages.csv, longest range) to run the per-page authority/snippet/on-page split from ch 23 and build DialerSeat's own position→CTR curve.
   - A dated change log with the expected effect of each SEO change written down before it ships (Appendix C).
6. **Decision date: late January 2027.** Don't judge the SEO strategy on traffic before then (ch 14, 32).
