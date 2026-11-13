import {
  ArrowRight, Ban, Boxes, Check, Clock, CreditCard, FlaskConical, KeyRound, Layers, ListChecks,
  PanelsTopLeft, PhoneCall, Repeat, ShieldCheck, SlidersHorizontal, Voicemail, Webhook,
} from 'lucide-react'
import { DevLink } from '@/components/developers/base'
import { DevFooter, DevTopNav } from '@/components/developers/MarketingChrome'
import { HeroCode } from '@/components/developers/HeroCode'
import { DIAL_MODES, SALES_EMAIL, TIERS } from '@/lib/developers/catalog'

// The landing page for dev.dialerseat.com. Every claim here is something the
// product does or the docs specify; no customer counts, no logos, no numbers
// that have not been measured.

const STEPS = [
  { n: '01', title: 'Activate a developer account', body: 'Sign in with any DialerSeat login and activate. Free. Test keys straight away.' },
  { n: '02', title: 'Create seats', body: 'One API call per user, keyed on your own user id. Call it again and it updates.' },
  { n: '03', title: 'Mint a session', body: 'A 15-minute, single-use token signs the user into the dialer. No second login.' },
  { n: '04', title: 'Drop in the miniplayer', body: 'One script tag and a mount call. The DialerSeat dialer appears on your page.' },
  { n: '05', title: 'Take the results', body: 'Webhooks bring back every call and disposition under your own codes and ids.' },
]

const CAPS = [
  { icon: SlidersHorizontal, title: 'Every dial mode', body: `${DIAL_MODES.map(m => m.name).join(', ')}. Set one for your whole platform, then make exceptions per seat or campaign.` },
  { icon: PanelsTopLeft, title: 'The miniplayer', body: 'The portable DialerSeat dialer: lead queue, call controls and your disposition picker in one compact panel on your page.' },
  { icon: ListChecks, title: 'Your dispositions', body: 'Agents pick from your outcomes, not ours. Each maps to an outcome class so redials and do-not-call still work.' },
  { icon: Webhook, title: 'Signed webhooks', body: 'call.answered, call.ended, call.dispositioned, recording.ready and more, signed with HMAC-SHA256 and retried for 72 hours.' },
  { icon: Voicemail, title: 'AMD and voicemail drop', body: 'Answering-machine detection per campaign, with the result on every answered call and a voicemail drop after the beep.' },
  { icon: Clock, title: 'Calling hours, per lead', body: 'Enforced in the time zone of the person being called, the same way every DialerSeat campaign is. Not switchable off by API.' },
  { icon: CreditCard, title: 'Billing your way', body: 'Users pay DialerSeat by the week inside the miniplayer, or you pay for them on one invoice, or a mix of both.' },
  { icon: FlaskConical, title: 'A real test mode', body: 'Test keys run the whole API and fire real webhooks with nothing dialled. Build the integration before you pay for a call.' },
  { icon: Ban, title: 'Do-not-call across the platform', body: 'One call suppresses a number on every campaign. A disposition mapped to do-not-call does it for you.' },
]

const FAQ = [
  { q: 'Is it free to build?', a: 'Yes. A developer account is free and includes the console, test keys, the full API, webhooks and the miniplayer in test mode. You pay when calls are real.' },
  { q: 'Do I need a dialerseat.com subscription?', a: 'No. dev.dialerseat.com uses the same login as dialerseat.com, but the two accounts are independent. Your developer account does not need a dialerseat.com plan, and a dialerseat.com plan does not switch on live dialing for your platform.' },
  { q: 'Can I still use DialerSeat myself?', a: 'Yes. A developer can subscribe to their own dialer on dialerseat.com and own their own teams, exactly as anyone else does. If you are already subscribed, nothing about your dialer changes.' },
  { q: 'Which CRMs does it work with?', a: 'Any. There is no per-CRM connector to wait for. If your app can make an HTTPS request and render a script tag, it can embed DialerSeat.' },
  { q: 'Who pays for a seat?', a: 'You choose. User-billed seats pay DialerSeat by the week inside the miniplayer. Platform-billed seats go on your weekly invoice at your negotiated rate. Mixed lets you choose per seat.' },
  { q: 'How are platform rates set?', a: `By volume and leverage: a price per seat per week, dials included, and a price per dial beyond them. Rates are agreed with ${SALES_EMAIL} and are subject to change.` },
  { q: 'Which numbers can it dial?', a: 'US numbers today: 10 digits, or 11 starting with 1. Every lead you send is checked and the response tells you exactly which were accepted and why any were not.' },
  { q: 'Can the dialer carry our brand?', a: 'A white-label miniplayer is part of the Partner tier. Talk to sales.' },
]

const COMPARE = [
  { row: 'What it takes to start', us: 'Keys and a script tag', build: 'Build the dialer first', seat: 'Their partner process' },
  { row: 'Predictive pacing, AMD, calling hours', us: 'Included', build: 'You build them', seat: 'Often behind the top plan' },
  { row: 'Your campaigns and dispositions', us: 'Yes, by your ids', build: 'Yes, you build it', seat: 'Usually theirs' },
  { row: 'Self-serve keys and test mode', us: 'Yes', build: 'Yes', seat: 'Rarely' },
  { row: 'Billing term', us: 'Weekly', build: 'Usage', seat: 'Monthly or annual' },
  { row: 'Who keeps the dialer working', us: 'DialerSeat', build: 'Your team', seat: 'The vendor' },
]

export default function DevelopersHome() {
  return (
    <>
      <DevTopNav />
      <main>
        {/* ── hero ── */}
        <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--dv-border-soft)' }}>
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(900px 420px at 20% -10%, rgba(74,158,255,.16), transparent 60%), radial-gradient(700px 380px at 95% 10%, rgba(42,110,255,.12), transparent 60%)' }} />
          <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)', backgroundSize: '44px 44px', maskImage: 'linear-gradient(to bottom, #000 30%, transparent)' }} />
          <div className="dv-hero" style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '84px 20px 80px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)', gap: 56, alignItems: 'center' }}>
            <div>
              <span className="dv-badge dv-badge-blue" style={{ marginBottom: 22 }}><span className="dv-dot" /> DialerSeat for Developers</span>
              <h1 style={{ fontSize: 'clamp(34px, 5vw, 54px)', lineHeight: 1.06, margin: 0, fontWeight: 600, letterSpacing: '-.8px' }}>
                The dialer API for <span style={{ background: 'linear-gradient(135deg, #7cbcff, #4a9eff 40%, #2a6eff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>CRMs and platforms.</span>
              </h1>
              <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--dv-muted)', margin: '22px 0 32px', maxWidth: 560 }}>
                Put DialerSeat&apos;s dialer inside your product with one script tag and a REST API. Your users dial from your pages. Every outcome comes back to you under your own campaigns and your own dispositions.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <DevLink href="/sign-up" className="dv-btn dv-btn-primary dv-btn-lg">Start building free <ArrowRight size={16} /></DevLink>
                <DevLink href="/docs/quickstart" className="dv-btn dv-btn-lg">Read the quickstart</DevLink>
              </div>
              <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 30, fontSize: 13 }} className="dv-muted">
                {['Free to build', 'Test keys in a minute', 'Every dial mode', 'Billed weekly'].map(s => (
                  <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Check size={14} color="var(--dv-green)" /> {s}</span>
                ))}
              </div>
            </div>
            <HeroCode />
          </div>
        </section>

        {/* ── how ── */}
        <section id="how" style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 20px 40px', scrollMarginTop: 100 }}>
          <SectionHead eyebrow="How it works" title="Five steps from keys to a dialer on your page." sub="Quick to set up, and easy to keep running. Everything below works in test mode before you pay for a single call." />
          <div className="dv-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 14, marginTop: 40 }}>
            {STEPS.map(s => (
              <div key={s.n} className="dv-card" style={{ padding: 20 }}>
                <div className="dv-mono" style={{ color: 'var(--dv-accent)', fontSize: 12, marginBottom: 14 }}>{s.n}</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{s.title}</div>
                <div className="dv-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── split of responsibilities ── */}
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px' }}>
          <div className="dv-grid-2">
            <div className="dv-card" style={{ padding: 28 }}>
              <div className="dv-row" style={{ marginBottom: 14 }}><Boxes size={18} color="var(--dv-accent)" /><span style={{ fontWeight: 600 }}>Stays yours</span></div>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--dv-muted)', fontSize: 14, lineHeight: 2 }}>
                <li>Your users and how they sign in</li>
                <li>Your contacts, lists and CRM records</li>
                <li>Your campaigns, by your own ids</li>
                <li>Your disposition codes and labels</li>
                <li>What you charge your customers</li>
              </ul>
            </div>
            <div className="dv-card" style={{ padding: 28 }}>
              <div className="dv-row" style={{ marginBottom: 14 }}><PhoneCall size={18} color="var(--dv-accent)" /><span style={{ fontWeight: 600 }}>DialerSeat runs</span></div>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--dv-muted)', fontSize: 14, lineHeight: 2 }}>
                <li>The dialing engine and its pacing</li>
                <li>Answering-machine detection and voicemail drop</li>
                <li>Caller ID from a managed number pool</li>
                <li>Calling hours in each lead&apos;s time zone</li>
                <li>Recording, call records and the carrier</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── capabilities ── */}
        <section id="capabilities" style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 20px 40px', scrollMarginTop: 100 }}>
          <SectionHead eyebrow="Capabilities" title="The whole dialer, through an API." sub="The same engine dialerseat.com runs on. Nothing about it is a lite version." />
          <div className="dv-grid-3" style={{ marginTop: 40 }}>
            {CAPS.map(c => (
              <div key={c.title} className="dv-card" style={{ padding: 22 }}>
                <span style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--dv-accent-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <c.icon size={18} color="var(--dv-accent)" />
                </span>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{c.title}</div>
                <div className="dv-muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{c.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── accounts ── */}
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px' }}>
          <div className="dv-card" style={{ padding: '32px 32px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 32, alignItems: 'center' }} >
            <div>
              <div className="dv-row" style={{ marginBottom: 10 }}><KeyRound size={18} color="var(--dv-accent)" /><span className="dv-dim" style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' }}>Accounts</span></div>
              <h2 style={{ fontSize: 24, margin: 0, fontWeight: 600 }}>One login. Two independent accounts.</h2>
              <p className="dv-muted" style={{ fontSize: 14, lineHeight: 1.7, margin: '12px 0 0' }}>
                Sign in here with your DialerSeat login. Your developer account and your dialerseat.com account never affect each other.
              </p>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                ['Developer account', 'Free. Console, keys, API, webhooks and settings, all in test mode.'],
                ['Live dialing', 'Paid. The only thing that turns real calls on for your platform.'],
                ['Your own dialer', 'Still on dialerseat.com, with your own plan and your own teams, exactly as before.'],
              ].map(([t, d]) => (
                <div key={t} className="dv-inset" style={{ padding: '12px 14px', display: 'flex', gap: 12 }}>
                  <ShieldCheck size={16} color="var(--dv-green)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div><div style={{ fontSize: 14, fontWeight: 600 }}>{t}</div><div className="dv-muted" style={{ fontSize: 13, marginTop: 2 }}>{d}</div></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── pricing ── */}
        <section id="pricing" style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 20px 40px', scrollMarginTop: 100 }}>
          <SectionHead eyebrow="Pricing" title="Free to build. Priced on your volume." sub={`Every live tier includes every dial mode. Platform rates are negotiated on volume and leverage with ${SALES_EMAIL}, and are subject to change.`} />
          <div className="dv-tiers" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginTop: 40 }}>
            {TIERS.map(t => {
              const featured = t.id === 'scale'
              return (
                <div key={t.id} className="dv-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', borderColor: featured ? 'rgba(74,158,255,.45)' : undefined, boxShadow: featured ? '0 0 0 1px rgba(74,158,255,.2), 0 20px 60px rgba(42,110,255,.12)' : undefined }}>
                  <div className="dv-row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{t.name}</span>
                    {featured && <span className="dv-badge dv-badge-blue">Volume pricing</span>}
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 600, margin: '16px 0 4px' }}>{t.price}</div>
                  <div className="dv-dim" style={{ fontSize: 12.5, minHeight: 34 }}>{t.priceNote}</div>
                  <div className="dv-muted" style={{ fontSize: 13, margin: '10px 0 16px', lineHeight: 1.5 }}>{t.who}</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', display: 'grid', gap: 9, fontSize: 13.5, flex: 1 }}>
                    {t.features.map(f => <li key={f} style={{ display: 'flex', gap: 8 }}><Check size={15} color="var(--dv-green)" style={{ flexShrink: 0, marginTop: 2 }} />{f}</li>)}
                  </ul>
                  {t.cta === 'start'
                    ? <DevLink href="/sign-up" className={`dv-btn${featured ? ' dv-btn-primary' : ''}`}>Start building</DevLink>
                    : <a href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(`DialerSeat for Developers: ${t.name}`)}`} className={`dv-btn${featured ? ' dv-btn-primary' : ''}`}>Talk to sales</a>}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── compare ── */}
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 20px 40px' }}>
          <SectionHead eyebrow="Build, partner or embed" title="Three ways to put a dialer in your CRM." sub="Building on a raw voice API means building the dialer. Per-seat embedded dialers mean their plans and their data model. DialerSeat is the dialer, on your terms." />
          <div className="dv-compare-cards" style={{ marginTop: 28, display: 'none', gap: 10 }}>
            {COMPARE.map(r => (
              <div key={r.row} className="dv-card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>{r.row}</div>
                <div style={{ display: 'grid', gap: 6, fontSize: 13.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: 'var(--dv-accent)' }}>DialerSeat</span><strong style={{ textAlign: 'right' }}>{r.us}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }} className="dv-muted"><span>Build on a voice API</span><span style={{ textAlign: 'right' }}>{r.build}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }} className="dv-muted"><span>Per-seat dialers</span><span style={{ textAlign: 'right' }}>{r.seat}</span></div>
                </div>
              </div>
            ))}
          </div>
          <div className="dv-card dv-table-wrap dv-compare-table" style={{ marginTop: 32 }}>
            <table className="dv-table" style={{ minWidth: 640 }}>
              <thead><tr><th></th><th style={{ color: 'var(--dv-accent)' }}>DialerSeat for Developers</th><th>Build on a voice API</th><th>Per-seat embedded dialers</th></tr></thead>
              <tbody>
                {COMPARE.map(r => (
                  <tr key={r.row}><td className="dv-muted">{r.row}</td><td style={{ fontWeight: 600 }}>{r.us}</td><td className="dv-muted">{r.build}</td><td className="dv-muted">{r.seat}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── faq ── */}
        <section id="faq" style={{ maxWidth: 900, margin: '0 auto', padding: '64px 20px 40px', scrollMarginTop: 100 }}>
          <SectionHead eyebrow="Questions" title="What platforms ask first." />
          <div style={{ marginTop: 32, display: 'grid', gap: 10 }}>
            {FAQ.map(f => (
              <details key={f.q} className="dv-card dv-faq" style={{ padding: '4px 22px' }}>
                <summary style={{ cursor: 'pointer', padding: '16px 0', fontSize: 15, fontWeight: 500, listStyle: 'none', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  {f.q}<span className="dv-dim dv-faq-plus">+</span>
                </summary>
                <p className="dv-muted" style={{ margin: '0 0 18px', fontSize: 14, lineHeight: 1.7 }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── cta ── */}
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 20px 40px' }}>
          <div className="dv-card" style={{ padding: '48px 32px', textAlign: 'center', background: 'radial-gradient(600px 240px at 50% 0%, rgba(74,158,255,.14), transparent 70%), var(--dv-panel)' }}>
            <Layers size={26} color="var(--dv-accent)" />
            <h2 style={{ fontSize: 30, margin: '14px 0 10px', fontWeight: 600 }}>Put DialerSeat in your platform.</h2>
            <p className="dv-muted" style={{ fontSize: 15, margin: '0 auto 26px', maxWidth: 560, lineHeight: 1.6 }}>Activate a free developer account and have a test dialer on your page today. Talk to sales when you are ready for live volume.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <DevLink href="/sign-up" className="dv-btn dv-btn-primary dv-btn-lg">Start building free <ArrowRight size={16} /></DevLink>
              <a href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent('DialerSeat for Developers')}`} className="dv-btn dv-btn-lg"><Repeat size={15} /> Talk to sales</a>
            </div>
          </div>
        </section>
      </main>
      <DevFooter />
      <style>{`
        .dv-faq summary::-webkit-details-marker { display: none; }
        .dv-faq[open] .dv-faq-plus { transform: rotate(45deg); }
        .dv-faq-plus { transition: transform .15s; font-size: 18px; }
        @media (max-width: 1000px) {
          .dv-hero { grid-template-columns: minmax(0, 1fr) !important; padding-top: 56px !important; gap: 36px !important; }
          .dv-steps { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .dv-tiers { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 640px) {
          .dv-steps, .dv-tiers { grid-template-columns: minmax(0, 1fr) !important; }
          .dv-compare-table { display: none; }
          .dv-compare-cards { display: grid !important; }
          section .dv-card[style*="grid-template-columns"] { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </>
  )
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase', color: 'var(--dv-accent)', marginBottom: 12 }}>{eyebrow}</div>
      <h2 style={{ fontSize: 'clamp(26px, 3.4vw, 36px)', margin: 0, fontWeight: 600, letterSpacing: '-.4px', lineHeight: 1.15 }}>{title}</h2>
      {sub && <p className="dv-muted" style={{ fontSize: 16, lineHeight: 1.65, margin: '14px 0 0' }}>{sub}</p>}
    </div>
  )
}
