# The RankHonestly book, applied to DialerSeat

Every chapter of the book checked against what DialerSeat already has, written as actions. Chapter numbers point into [rankhonestly-book-notes.md](rankhonestly-book-notes.md). The live audit is in [site-audit-2026-11-04.md](site-audit-2026-11-04.md); copy drafts awaiting approval are in [copy-review-2026-11-04.md](copy-review-2026-11-04.md).

Where DialerSeat stands on the book's own clock: most SEO pages shipped 25–26 Sept, so the site is in the window where traffic cannot tell working from failing (ch 2, 14, 32). Search referrals went 4 → 55 a week, which is the right shape and too small to read. **Decision date: late January 2027.** Until then, judge the inputs (pages indexed, links earned, launches done), not the traffic.

---

## Already done (4 Nov 2026)

- Hidden FAQ markup removed from 47 page templates (92 pages); FAQ markup kept only where the questions are visible.
- Every CNAM claim removed from pages, structured data, llms files and all 11 translations; the 10DLC page now answers "does DialerSeat handle CNAM?" truthfully.
- " | DialerSeat" dropped from every tab title in all 12 languages.
- Test tenants removed from the sitemap index.
- `scripts/seo-check.mjs`: the chapter 38 checklist as a script. Run `node scripts/seo-check.mjs` (or with a preview URL) before promoting a deploy; it exits 1 on a hidden FAQ, a bad canonical, a missing H1, noindex, broken JSON-LD or a fake rating.

---

## The gems: highest leverage, in order

### 1. Say one checkable sentence, everywhere, forever (ch 5, 13, 24, 26)
The book's single strongest finding: every earned link cited a claim a stranger could verify in one step, never the feature list. DialerSeat already has its structural claim, the thing incumbents' business model forbids:

> **A week of DialerSeat costs $35. A week of ReadyMode costs $199 and Mojo $149, because they bill by the month.**

Contract and demo-led dialers forecast revenue on monthly and annual commitments; weekly billing breaks their model, so they won't copy it. It's checkable at checkout in one step, and /pricing already says it.
- Make it the one sentence in `FACTS.oneLine` (`lib/canonicalFacts.ts`), the homepage, every pitch, every launch post and every community answer, word for word. A model learns a category↔phrase association only from a phrase that never varies (ch 13).
- Test it against the book's three questions: repeatable after one reading (yes), verifiable in one step (yes: the price at checkout), surprising to someone who knows dialers (yes: nobody bills weekly).

### 2. Lead outreach with the data nobody else has (ch 24, 28)
"Go and measure something" is the book's fallback for a product with no story, and DialerSeat has already measured three things:
- **/faq/why-we-dont-rest-flagged-numbers**: rested numbers came back worse than new ones, and cutting volume recovered them in days. A counterintuitive finding with data is exactly the "we measured something nobody has" shape.
- **/data/connect-rates**: live answer rates by state and hour from real calls. No competitor can copy it. Publish the quarterly "best time to cold call, by state" from it (`docs/VISIBILITY.md` §4).
- **/data/dialer-pricing**: 30 dialers' published prices, contract terms and minimums: the book's "test 50 tools" study, already done.

Pitch these, never the product. The rhythm: **3–5 targeted emails a day plus 2–3 genuine community answers a week**, aiming at 20–30 referring domains a quarter. Expect about 2 links per 50 emails; judge on an 8–12 week lag; stop a campaign only if 100 well-targeted emails produce nothing, which means the sentence needs work, not more emails. The book's biggest mistake was starting this in month seven. DialerSeat is in month three.

Targets that fit dialers (ch 28's "nobody pitches these"):
- "Best auto dialer / best dialer for real estate / insurance" listicles that already link to tools (search `"best auto dialer" -dialerseat`, `"mojo alternative"`, `"readymode alternative"`).
- Insurance IMO/FMO and real-estate-investor resource pages, BiggerPockets threads and wikis, collections compliance blogs.
- **Compliance trainers and call-center associations** for the two calculators. `/embed/[tool]` already exists with a credit link; offer the embed, it is the link.
- University professional-selling programs (sales labs, sales-competition sites) keep "tools for students" pages; rarely pitched.

### 3. More doors: small free tools, each checked for demand first (ch 3, 4, 6, 35, 37)
Two tools exist. The book's engine was many small, free, no-account pages, each fully doing one job a stranger searches for, each costing under two days, winners impossible to predict. For every candidate, run the ch 1 test first: does autocomplete finish the phrase? Build only those that pass; ship one or two a week, not ten at once, so the results stay readable.

Candidates (verify each before building):
- **"Can I call this number now?"**: paste numbers, get the lead's local time and whether it's inside the TCPA window for their state. Uses the server-side window logic already in the dialer.
- **Area code lookup / local presence finder**: area code → state, city, time zone, and whether DialerSeat has a local number for it.
- **Phone list cleaner**: paste or upload a CSV, get E.164-formatted, de-duplicated numbers and the rows that won't dial. A cold-calling job every list buyer has.
- **Agents / lines-per-agent calculator**: dials per hour and agents needed from answer rate and talk time; predictive pacing in reverse.
- **Best time to call, by state**: an interactive front end on /data/connect-rates.
- **Cold-calling and voicemail script templates by industry**: real estate, insurance, mortgage, solar, B2B.
- **DNC registry cost calculator**: area codes needed → annual fee, from the Oct 2026 price table already on the scrub page.

Rules from the book: no account and no email gate before it works; nothing uploaded where it can run in the browser, and say so (the checkable claim); mention DialerSeat once, at the bottom, after the tool has done its job (ch 35). Don't delete the losers; they cost nothing to keep (ch 3).

### 4. Win where supply is thin, not where volume is (ch 4, 21)
"Auto dialer", "predictive dialer" and "power dialer" are head terms owned by incumbents with ten-year domains. Keep those pages, budget nothing for them, and never measure success by them. Look for jobs the big sites skipped:
- **Failure searches**: "calls going straight to voicemail", "spam likely on my number", "scam likely fix", "abandon rate too high", "dialer dropping calls", "calls not connecting". /faq/why-calls-show-spam-likely is the model; build more of them.
- **Read the incumbents' sitemaps for what's missing** (ReadyMode, Mojo, PhoneBurner, BatchDialer): the absences are their revenue-bar decisions published on their own sites.
- **State-by-state calling rules**, the book's richest vein ("jobs named by law"): one page per state only where each has its own verified substance (state DNC list, registration or bond, mini-TCPA such as Florida's FTSA, state hours). A page that only swaps the state name is the thin-page pattern the book warns about (ch 37); five real ones beat fifty templated ones.
- Treat the US position as the authority scoreboard: it moves first when links start working (ch 21).

### 5. Launch now, where you can win (ch 25, 26)
A launch is the only channel with no settlement lag, and it works best with no traction. Pick a platform where a small product places (the case won Peerlist's Launchpad at 19 days old), not just the biggest. Product Hunt is fine once, prepared a week ahead. Copy structure, all present in DialerSeat's story:
- Open on a specific moment, not the product: an agent who needs a dialer for a two-week campaign and is quoted a monthly seat, an annual contract and a demo call.
- A specific villain (the annual contract, the "book a demo" button), plus the honest "just dial by hand" option.
- One checkable claim: the weekly price, visible at checkout.
- Four consistent screenshots (they exist on /screenshots), the stack named for technical audiences, and every comment answered on the day.

### 6. Make the name unambiguous (ch 9, 10, 25, 27)
/vs/dialer-io is the top non-brand search landing page, and assistants have shown dialer.io imagery for DialerSeat: the confusable-neighbour situation in ch 10 and ch 27, where the case lost its own brand query to a lower-authority site.
- `sameAs` with every real company profile, and `alternateName` for "Dialer Seat", "dialerseat" and "dialerseat.com" (`lib/schema.ts`).
- Claim Google Business Profile and Bing Places: entity registrations, not link sources.
- The ten real directories, once, over a weekend: Crunchbase, G2, Capterra/GetApp, SaaSHub, AlternativeTo, Clutch, GoodFirms, Product Hunt profile, TrustRadius, SourceForge. Same name, same one-line tagline, same three categories in every one. No badge walls, no bookmark networks (ch 25).
- Monthly: search "dialerseat", "dialer seat" and "dialerseat login" and note who ranks and who has sitelinks. A quarterly ch 27 teardown of dialer.io, ending in one sentence: "they beat us because ___".

### 7. Fix what happens after the click (ch 18, 19, 20)
The book calls this the cheapest growth available, and DialerSeat has no instrument for it: page_views records dwell time but not failed clicks, and about half of visits on both desktop and mobile end in under 10 seconds.
- A first-party dead-click log that fits the privacy stance already in `app/api/analytics/pageview`: record only the clicked element's tag and a class path when a click changes nothing, with no text, no identity, no recording. Then fix the top five targets.
- Add INP and CLS from real visitors to the same table (the `web-vitals` package, a few lines). Lab numbers flatter (ch 11).
- Define the activation event and measure the share of sign-ups that reach it: first campaign started, or first call placed. The Sept funnel finding (every real non-payer stalled at billing) says the first leak is billing, not search.
- Acknowledge every action within 100 ms: spinner, disabled state, progress bar (ch 19).

### 8. Measure the way the book does (ch 13, 14, 15, 16, 22, 23, 33, App. A–D)
- **Weekly, per channel, looking for zeros**: Google, Bing, social, AI, direct. A blended total hides a dead channel (Bing sat near zero all autumn).
- **28-day windows only** at this volume; never compare days. Set the action threshold before looking (for example, a 20% change held for 14 days).
- **Search Console export monthly** (Queries.csv, Pages.csv, longest range), kept on disk. With it: split brand from non-brand, build DialerSeat's own position→CTR curve, list pages over 5,000 impressions and under 1% CTR, and classify each page as on-page, snippet or authority (ch 23) before planning a quarter.
- **AI prompt set monthly**: ten fixed buyer questions (for example "best dialer for insurance agents", "dialer without a contract", "ReadyMode alternatives"), asked in fresh sessions to ChatGPT, Claude, Gemini, Perplexity and Copilot. Record named or not, and the phrase used. If the phrase isn't the weekly-billing sentence, fix the sentence, not the volume. The referrer count is a floor (zero so far), not a measurement.
- **Dated change log with predictions**: CHANGES.md already exists; add one line per SEO change saying what it should move, by when. Never bundle a resubmit with a big change: the resubmit will take the credit (ch 22).
- **Cliff vs slope**: a channel at zero is technical (console, sitemap, reindex, then infrastructure, cheapest first); a gradual fall is ranking (wait).

---

## Smaller things that still help

- **Titles and descriptions**: 22 titles and 98 descriptions drafted in the copy review, waiting for your yes. Low on page one, a title that names the searcher's fear ("no contract", "weekly", "no setup fee") clicks about 8× more (ch 7).
- **Direct answers**: 84 pages open with fewer than 40 words before the detail. Each should answer its query in 40–80 self-contained words right under the H1, with no "as above". It's the passage snippets and AI answers lift (ch 7 Field 1, ch 12). The country-page version needs no new translation (copy review).
- **One accuracy check left**: /faq/numbers says "A-Level, on every number, by default", while every other page says A-attestation "where supported". Pick one wording; a trust product can't carry two (ch 29).
- **HowTo markup** only where numbered steps are visible: /faq/mobile install steps, /faq/send-leads-from-your-crm, the DNC scrub steps (ch 8).
- **Comparison pages are the right content type** (ch 29 lists "X vs Y" among the ten posts worth writing). Keep them; give each one an honest "when the other tool is the better choice" section (ch 7 Field 8c), which the book found earns trust and links.
- **The 32 generated matchup pages** (/vs/x-vs-y) had 9 visits in ten weeks. Too early to judge. After 120 days, split them by impressions: none means no demand (leave or merge); plenty with no clicks means rewrite the title (ch 37).
- **Translated results**: check Search Console → Search appearance for a "Translated results" row (ch 21). Twelve languages are live; add no more until one market shows authority. Keep sentences short and literal, since that's what translates.
- **Marketing pages render per request** (no-store, behind Clerk). Serving them statically or with ISR would cut server work and protect speed under load (ch 11). Minor at this traffic.
- **llms.txt**: keep it as is; no more investment (ch 12).
- **Re-run the audit when the data doubles**, with the same script (ch 36). `scripts/seo-check.mjs` is that script for the page checks.

---

## What the book says not to do

- No bookmark-network or badge-exchange link building, no paid links, no invented ratings or testimonials (ch 25, 29).
- Don't rewrite pages to escape positions 6–10: past page one's bottom the constraint is authority, and two rounds of on-page work moved nothing in the case (ch 23).
- Don't chase Domain Rating; it can be manufactured and doesn't predict rankings (ch 25, 27).
- Don't start a blog that competes with the FAQ and tool pages for the same queries (ch 6, 29).
- Don't judge on traffic before late January, and don't check the dashboard daily (ch 14, 15).
- Don't build pages for queries nobody types, or that the page only half answers (ch 1, 31, 37).

---

## Needs you

| | Why it's yours |
|---|---|
| Add `www.dialerseat.com` in Vercel → dialer-seat → Settings → Domains → **Add Domain**, then choose "Redirect to dialerseat.com" (308). Don't edit the existing dialerseat.com row: that's where "a domain cannot redirect to itself" comes from. | Needs your Vercel login; the change was blocked for me. |
| Approve or edit the copy review (titles, descriptions, country openers). | Your copy. |
| Create the company profiles and directory listings; send me the URLs for `sameAs`. | Your accounts. |
| Confirm Bing Webmaster Tools, and export Search Console monthly. | Your Google and Microsoft logins. |
| Pick the launch platform and date. | Your call, and your account. |
| Say yes to the dead-click log and real-user vitals. | It adds first-party measurement to a site with a stated no-tracking stance. |
