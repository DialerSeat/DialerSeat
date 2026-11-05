# The SEO playbook, as steps

Everything worth keeping from the RankHonestly book and the November 2026 work on dialerseat.com, in the order to do it. The reasoning and chapter references live in [book-applied-to-dialerseat.md](book-applied-to-dialerseat.md). Status is as of 5 Nov 2026.

**[Joshua]** needs your login, money or name. **[Claude]** can be done in code. **Done** is already live.

## The three rules underneath everything

1. Intercept demand that already exists. If Google autocomplete doesn't finish the phrase, don't build the page.
2. Below page one's top half, the limit is authority, not wording. Links move rankings; rewriting pages at position 6–20 doesn't.
3. You can't predict which page wins. Make attempts cheap, keep the losers, and judge on a quarter. Decision date: **late January 2027**.

## Stage 1: Make the site readable to a crawler

1. **Done** Serve finished HTML with one H1, a canonical, a title and a description on every page.
2. **Done** Run `node scripts/seo-check.mjs` after marketing pushes. It fails on hidden FAQ markup, bad canonicals, missing H1s, noindex and fake ratings. Last run: 0 of 1,975 failing across all 12 languages.
3. **Done** Run `node scripts/seo-links.mjs` for broken links, redirects and pages nothing links to. Last run: 0 broken, 0 redirecting.
4. **Done** Mark up only what's visible. FAQ markup needs the question on the page; no HowTo, no speakable, no AggregateRating.
5. **Done** Tell the truth in every claim. Unverifiable numbers come out, and a dash beats an invented figure.
6. **[Joshua]** Add `www.dialerseat.com` in Vercel as a redirect to the apex. It still fails with a certificate error.

## Stage 2: Own your name

7. **Done** Add `alternateName` on the Organization and WebSite markup.
8. **[Joshua]** Create the real company profiles (Crunchbase, G2, Capterra/GetApp, SaaSHub, AlternativeTo, Clutch, GoodFirms, Product Hunt, TrustRadius, SourceForge) over one weekend. Use the same name, tagline and three categories everywhere. No badge walls or bookmark networks.
9. **[Claude]** Put those URLs in `sameAs` in `lib/schema.ts`. It's empty today.
10. **[Joshua]** Claim Google Business Profile and Bing Places.
11. **[Joshua]** Buy `dialer-seat.com` and `dialerseat.net` and redirect them.

## Stage 3: Say one sentence, forever

12. Use one checkable sentence, word for word, in every pitch, launch post and community answer: **"A week of DialerSeat costs $35. A week of ReadyMode costs $199 and Mojo $149, because they bill by the month."**
13. Test any replacement three ways: repeatable after one reading, checkable in one step, surprising to someone who knows dialers.
14. Lead with the moat: weekly billing is what contract-based competitors' business model forbids, and none of the 29 dialers in the pricing index bills weekly.

## Stage 4: Build more doors, one job per page

Repeat this loop for every new page:

15. Run the phrase through autocomplete and save the result.
16. Search it. Build only if supply is thin, or the answers are old or wrong.
17. Build backwards from the search: H1 is the job, a 40–80 word answer sits under it, and the working tool comes straight after.
18. No account, no email gate, no ads. Run it in the browser and say so. Mention DialerSeat once, at the end.
19. Read every fact from the primary source and date it. If the source doesn't give a price, say that.
20. Link it from the pages whose readers need it, and from its neighbours.
21. Add a dated line to [measurement.md](measurement.md) saying what it should do, before it ships.
21a. Run `node scripts/gen-page-dates.mjs` before committing, so the sitemap's lastmod says the day the page really changed. `lib/pageDates.ts` is generated; never edit it by hand. A new page in `lib/tools/registry.ts` reaches the sitemap by itself; any other new page needs adding to `app/sitemap.ts`.
22. Ship one or two a week. Keep the losers.

**Live doors:** 18 tools at /tools, the Spam Likely fix page, 49 matchup pages, 32 competitor pages.

**Next doors, demand confirmed by autocomplete:**

| Door | Searches seen | Needs first |
|---|---|---|
| Power dialer for GoHighLevel | "power dialer for gohighlevel", "ghl local presence dialing" | Read HighLevel's webhook docs; say webhook, not native |
| Dialer for HubSpot, Salesforce, Pipedrive, Zoho | "best dialer for hubspot", "salesforce dialer pricing", "auto dialer for zoho crm" | Same; check which plans include webhooks |
| Dialer for life insurance agents | "best dialer for life insurance agents", "ai dialer for life insurance" | Real trade rules with sources |
| Dialer for truck dispatching, BPO, small business, solo | "best dialer for truck dispatching", "best dialer for bpo", "best auto dialer for small business", "power dialer for one person" | Only where there's real substance |
| Florida and Texas telemarketing rules | "florida mini tcpa", "florida telemarketing registration", "texas telemarketing registration requirements" | Primary statutes |
| Vulcan7 and Nooks competitor pages | "vulcan7 pricing", "nooks pricing", "orum vs nooks" | Sourced prices; never estimate |

**Don't build yet:**
- **Best time to cold call:** real demand, but /data/connect-rates shows 1 publishable row against 55 dashes. Wait until the buckets pass 250 calls.
- **Spam likely checker, free DNC checker:** real demand, but we can't honestly do either. We don't have carrier analytics or registry access.

## Stage 5: Link the site to itself

23. **Done** Tools link to their neighbours and from relevant FAQ pages.
24. **Done** Connect FAQ and vs pages through `lib/relatedLinks.ts`; see [internal-link-map.md](internal-link-map.md). Translated pages don't show these links yet.
25. Anchor text is the phrase people search, used only where the page really answers it.

## Stage 6: Earn links (this is what moves rankings)

26. **[Joshua]** Launch where a small product can win: Peerlist Launchpad first, Uneed and MicroLaunch the same week, Product Hunt 1–2 weeks later. Open on a moment (an agent needing two weeks of dialing and being quoted an annual contract), name the villain, give the one checkable claim, use four screenshots, and answer every comment that day.
27. **[Joshua]** Send 3–5 targeted emails a day and post 2–3 genuine community answers a week. Aim for 20–30 referring domains a quarter. Expect about 2 links per 50 emails, judged on an 8–12 week lag.
28. Pitch the data, never the product:
    - /data/dialer-pricing: 30 dialers' published prices, and none bills weekly.
    - /faq/why-we-dont-rest-flagged-numbers: rested numbers came back worse than new ones.
    - /tools/state-do-not-call-lists: eleven states read from their own sites, where the competing pages are old and disagree.
    - **Not /data/connect-rates yet.** It's nearly all dashes.
29. Offer the embed. Every tool has embed code with a credit link, which is the link. Good targets: compliance trainers, call-center associations, insurance IMOs and FMOs, real-estate investor resource pages, university sales programs.
30. If 100 well-targeted emails produce nothing, the sentence needs work, not more emails.

## Stage 7: Fix what happens after the click

31. **[Joshua]** Say yes or no to a first-party dead-click log and real-user vitals. Both add measurement to a site with a stated no-tracking stance.
32. **[Joshua]** Define the activation event: first campaign started, or first call placed.
33. Fix the billing stall first. The September funnel showed that's where real non-payers stop.

## Stage 8: Read the numbers without fooling yourself

34. **Weekly, 15 minutes:** run the per-channel query in [measurement.md](measurement.md), looking for zeros. A channel at zero is technical; a slow fall is ranking, so wait.
35. **28-day windows only.** Set the action threshold before you look.
36. **Monthly [Joshua]:** export Search Console and keep it in `docs/seo/`. With it, **[Claude]** splits brand from non-brand, lists pages over 5,000 impressions and under 1% CTR, and sorts every page into on-page, snippet or authority.
37. **Monthly:** ask the same ten buyer questions in five assistants, in fresh sessions. If DialerSeat is named generically, fix the sentence, not the volume.
38. **Quarterly:** re-run the same scripts, tear down one competitor, and finish the sentence "they beat us because ___".
39. **After 120 days:** split the unverified matchup pages by impressions. None means leave or merge; impressions without clicks means rewrite the title.

## Waiting on your approval

40. **[Joshua]** Review [copy-review-2026-11-04.md](copy-review-2026-11-04.md): 22 titles, 98 descriptions and the country openers.
41. **[Joshua]** Pick one wording for /faq/numbers: "A-Level, on every number, by default" or "where supported". Every other page says the second.

## Never

- Paid links, bookmark networks, badge exchanges, invented ratings or testimonials.
- Chasing Domain Rating.
- Rewriting a page to escape positions 6–10.
- A blog that competes with the FAQ and tools.
- A reindex request bundled with a big change. It takes the credit.
- A customer's real leads in samples, tests or public pages.
- Judging traffic before late January, or daily.
- Touching the dialer for any of this.
