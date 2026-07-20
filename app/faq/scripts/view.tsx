'use client'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: '#4a9eff',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

export default function ScriptsFaqView() {
  const { isSignedIn } = useUser()

  return (
    <div
      style={{
        flex: 1,
        background: T.bg,
        minHeight: 'calc(100vh - 64px)',
        fontFamily: 'Futura PT, Futura, sans-serif',
        color: T.text,
      }}
    >
      <style>{`
        .scr-root { max-width: 820px; margin: 0 auto; padding: 80px 32px 120px; }
        .scr-eyebrow {
          font-size: 11px; letter-spacing: 4px; color: ${T.muted};
          font-weight: bold; margin-bottom: 18px;
        }
        .scr-h1 {
          font-size: 42px; line-height: 1.15; letter-spacing: -0.5px;
          font-weight: 700; margin: 0 0 24px 0;
        }
        .scr-h1 em { font-style: normal; color: ${T.accent}; }
        .scr-deck {
          font-size: 19px; line-height: 1.6; color: ${T.muted};
          margin-bottom: 40px; max-width: 680px;
        }
        .scr-badge-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 56px; }
        .scr-badge {
          padding: 8px 16px; border-radius: 20px; font-size: 12px;
          font-weight: bold; letter-spacing: 1px; border: 1px solid ${T.border};
          background: white; color: ${T.text};
        }
        .scr-badge.hi { background: ${T.dark}; color: #a8b8ff; border-color: ${T.dark}; }

        .scr-section { margin: 56px 0; }
        .scr-section h2 {
          font-size: 13px; letter-spacing: 3px; font-weight: bold;
          color: ${T.accent}; margin: 0 0 18px 0;
          padding-bottom: 10px; border-bottom: 1px solid ${T.border};
        }
        .scr-section h3 {
          font-size: 22px; line-height: 1.3; font-weight: 700;
          margin: 28px 0 14px 0; letter-spacing: -0.2px;
        }
        .scr-section p {
          font-size: 16px; line-height: 1.75; margin: 0 0 18px 0;
          color: ${T.text};
        }
        .scr-section p.muted { color: ${T.muted}; font-size: 15px; }
        .scr-section strong { color: ${T.text}; font-weight: 700; }
        .scr-section em { font-style: italic; color: ${T.accent}; }
        .scr-section ul { margin: 14px 0 24px 0; padding-left: 22px; }
        .scr-section li { font-size: 16px; line-height: 1.75; margin-bottom: 8px; }
        .scr-section code {
          background: ${T.surface}; padding: 1px 6px; border-radius: 3px;
          font-size: 13.5px; font-family: monospace;
        }

        /* OWNERSHIP CARDS */
        .scr-owner-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0 8px; }
        .scr-owner-card { background: white; border: 1px solid ${T.border}; border-radius: 8px; padding: 22px 22px; }
        .scr-owner-card h4 { font-size: 15px; margin: 0 0 8px 0; font-weight: 700; color: ${T.accent}; }
        .scr-owner-card p { font-size: 14px; line-height: 1.65; margin: 0; color: ${T.muted}; }

        /* MOCKUP CARD */
        .scr-mockup {
          margin: 28px 0; background: ${T.dark}; border-radius: 10px; overflow: hidden;
          box-shadow: 0 20px 50px rgba(20,20,40,0.18);
        }
        .scr-mockup-bar { display: flex; gap: 6px; padding: 12px 16px; background: #111225; }
        .scr-mockup-dot { width: 10px; height: 10px; border-radius: 50%; }
        .scr-mockup-body { padding: 4px 20px 20px; }
        .scr-mockup-tabs { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .scr-mockup-tab {
          padding: 6px 14px; border-radius: 5px; font-size: 11px; font-weight: 700;
          letter-spacing: 0.5px; color: #8a8ea8; background: #1f2140;
        }
        .scr-mockup-tab.active { background: #4a5aff; color: white; }
        .scr-mockup-text {
          color: #d8dae8; font-size: 14px; line-height: 1.7; font-family: monospace;
          background: #14162a; border-radius: 6px; padding: 16px 18px;
        }

        /* FLOW LIST */
        .scr-flow { display: flex; flex-direction: column; gap: 0; margin: 24px 0 8px; }
        .scr-flow-step {
          display: flex; gap: 16px; padding: 14px 0; align-items: flex-start;
          border-left: 2px solid ${T.border}; padding-left: 22px; margin-left: 15px;
          position: relative;
        }
        .scr-flow-step::before {
          content: ''; position: absolute; left: -7px; top: 18px;
          width: 12px; height: 12px; border-radius: 50%;
          background: ${T.accent}; border: 2px solid white;
        }
        .scr-flow-step:last-child { border-left: 2px solid transparent; }
        .scr-flow-body h4 { font-size: 15px; margin: 0 0 4px 0; font-weight: 700; }
        .scr-flow-body p { font-size: 14px; line-height: 1.6; margin: 0; color: ${T.muted}; }

        .scr-callout {
          margin: 32px 0; padding: 22px 26px; background: ${T.surface};
          border-left: 3px solid ${T.blue}; border-radius: 4px;
        }
        .scr-callout p { font-size: 15px; line-height: 1.7; margin: 0; color: ${T.text}; }
        .scr-callout strong { color: ${T.accent}; }

        .scr-related {
          margin-top: 48px; padding-top: 28px; border-top: 1px solid ${T.border};
        }
        .scr-related-label {
          font-size: 10px; letter-spacing: 3px; color: ${T.muted};
          font-weight: bold; margin-bottom: 14px;
        }
        .scr-related-links { display: flex; gap: 24px; flex-wrap: wrap; }
        .scr-related-links a {
          font-size: 13px; color: ${T.accent}; text-decoration: none;
          border-bottom: 1px solid transparent; padding-bottom: 1px;
          transition: border-color 0.15s;
        }
        .scr-related-links a:hover { border-bottom-color: ${T.accent}; }

        .scr-cta-box {
          margin-top: 56px; padding: 40px 36px; background: ${T.dark};
          border-radius: 8px; text-align: center;
        }
        .scr-cta-box .scr-cta-eyebrow {
          font-size: 10px; letter-spacing: 4px; color: #a8b8ff;
          font-weight: bold; margin-bottom: 14px;
        }
        .scr-cta-box .scr-cta-h {
          font-size: 26px; color: white; font-weight: 700;
          margin: 0 0 12px 0; letter-spacing: -0.2px;
        }
        .scr-cta-box p { font-size: 15px; color: #c0c2ca; line-height: 1.6; margin: 0 0 28px 0; }
        .scr-cta-box .scr-cta-btn {
          display: inline-block; padding: 16px 36px;
          background: linear-gradient(135deg, #6a7aff, #4a5aff);
          border: none; border-radius: 6px; color: white;
          font-size: 12px; font-weight: bold; letter-spacing: 3px;
          text-decoration: none; font-family: 'Futura PT', Futura, sans-serif;
          box-shadow: 0 0 24px rgba(90,100,255,0.3);
        }

        @media (max-width: 768px) {
          .scr-root { padding: 48px 20px 80px; }
          .scr-h1 { font-size: 28px; }
          .scr-deck { font-size: 16px; }
          .scr-section h3 { font-size: 19px; }
          .scr-section p, .scr-section li { font-size: 15px; }
          .scr-owner-grid { grid-template-columns: 1fr; }
          .scr-cta-box { padding: 32px 24px; }
          .scr-cta-box .scr-cta-h { font-size: 22px; }
        }
      `}</style>

      <article className="scr-root">
        <div className="scr-eyebrow">▸ CALL SCRIPTS</div>

        <h1 className="scr-h1">
          Write it once. See it on <em>every</em> call, without alt-tabbing.
        </h1>

        <p className="scr-deck">
          Scripts live inside the dialer itself, right next to the lead
          profile — not in a separate doc you keep switching to mid-call.
          Write as many as you want, attach them to whichever campaigns
          need them, and control which one shows first.
        </p>

        <div className="scr-badge-row">
          <span className="scr-badge hi">INCLUDED ON EVERY PLAN</span>
          <span className="scr-badge">PERSONAL OR TEAM-SHARED</span>
          <span className="scr-badge">MULTIPLE SCRIPTS PER CAMPAIGN</span>
          <span className="scr-badge">REORDERABLE</span>
        </div>

        {/* ── WHAT IT LOOKS LIKE ─────────────────────────────────────────── */}
        <section className="scr-section">
          <h2>▸ WHAT AN AGENT ACTUALLY SEES</h2>
          <p>
            The active script for a campaign shows up in the lead profile
            panel, right there during the call. If a campaign has more
            than one script attached — say, different angles for
            different lead types — they show as tabs an agent can flip
            between without breaking their flow.
          </p>

          <div className="scr-mockup">
            <div className="scr-mockup-bar">
              <div className="scr-mockup-dot" style={{ background: '#ff5f56' }} />
              <div className="scr-mockup-dot" style={{ background: '#ffbd2e' }} />
              <div className="scr-mockup-dot" style={{ background: '#27c93f' }} />
            </div>
            <div className="scr-mockup-body">
              <div className="scr-mockup-tabs">
                <span className="scr-mockup-tab">LIFE</span>
                <span className="scr-mockup-tab">HEALTH</span>
                <span className="scr-mockup-tab active">REAL ESTATE</span>
                <span className="scr-mockup-tab">SOLAR</span>
              </div>
              <div className="scr-mockup-text">
                &quot;Hi (client), this is (your name) — I saw you were
                curious what your home might be worth.
                <br /><br />
                I can get you a real number today, and if you ever decide
                to sell, walk...&quot;
              </div>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            This is a real script layout, not a mockup — tabbed by
            vertical, plain text, no formatting to fight with.
          </p>
        </section>

        {/* ── PERSONAL VS TEAM ───────────────────────────────────────────── */}
        <section className="scr-section">
          <h2>▸ PERSONAL SCRIPTS VS. TEAM SCRIPTS</h2>
          <p>
            Every script belongs to either you personally or to a team you
            own — there&apos;s no separate &ldquo;company library&rdquo;
            concept beyond that.
          </p>

          <div className="scr-owner-grid">
            <div className="scr-owner-card">
              <h4>PERSONAL SCRIPT</h4>
              <p>Belongs to your account. Only you can attach it to your own campaigns. Anyone can write these — Pro or Manager+.</p>
            </div>
            <div className="scr-owner-card">
              <h4>TEAM SCRIPT</h4>
              <p>Belongs to a team you own (Manager+ required to own a team). Every agent on that team can see and use it on campaigns it&apos;s attached to — write it once, the whole floor is on the same script.</p>
            </div>
          </div>

          <p className="muted" style={{ marginTop: 16 }}>
            Only the team owner can create a script scoped to the team.
            Individual agents on a team can still write their own personal
            scripts for their own campaigns; they just can&apos;t publish
            one to the whole team unless they own it.
          </p>
        </section>

        {/* ── ATTACHING TO CAMPAIGNS ─────────────────────────────────────── */}
        <section className="scr-section">
          <h2>▸ HOW SCRIPTS ATTACH TO CAMPAIGNS</h2>
          <p>
            A script and a campaign are two separate things until you
            link them. One script can be attached to several campaigns at
            once, and one campaign can have several scripts attached — it&apos;s
            a many-to-many relationship, not a strict one-to-one.
          </p>

          <div className="scr-flow">
            <div className="scr-flow-step">
              <div className="scr-flow-body">
                <h4>1. WRITE THE SCRIPT</h4>
                <p>Create it once, name it, save it. It exists independently of any campaign until you attach it somewhere.</p>
              </div>
            </div>
            <div className="scr-flow-step">
              <div className="scr-flow-body">
                <h4>2. TOGGLE IT ONTO A CAMPAIGN</h4>
                <p>Turn it on for whichever campaign(s) should use it. Turning it off removes the link without deleting the script itself.</p>
              </div>
            </div>
            <div className="scr-flow-step">
              <div className="scr-flow-body">
                <h4>3. REORDER IF MORE THAN ONE IS ATTACHED</h4>
                <p>Whichever script sits first in the order is what agents see by default on that campaign — drag to reorder any time.</p>
              </div>
            </div>
          </div>

          <p className="muted" style={{ marginTop: 20 }}>
            Only a campaign&apos;s owner can attach or detach scripts on
            it, and you can only attach a script you actually have access
            to — your own, or one shared by a team you&apos;re an active
            member of.
          </p>
        </section>

        {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
        <div className="scr-callout">
          <p>
            <strong>Keep it simple —</strong> scripts are plain text, on
            purpose. No rich formatting, no branching logic, no
            conditional paths based on lead answers. If your process needs
            that level of complexity, most teams keep the DialerSeat
            script as the opening hook and lean on the{' '}
            <Link href="/faq/leads">lead record</Link> itself — name,
            state, custom fields from your upload — for the rest of the
            call.
          </p>
        </div>

        {/* ── RELATED ────────────────────────────────────────────────────── */}
        <div className="scr-related">
          <div className="scr-related-label">▸ RELATED READING</div>
          <div className="scr-related-links">
            <Link href="/faq/campaigns">Setting up a campaign</Link>
            <Link href="/faq/leads">Uploading &amp; managing leads</Link>
            <Link href="/faq/dialerseat-teams">DialerSeat for teams</Link>
            <Link href="/faq/dialer-modes">Dialer modes explained</Link>
            <Link href="/faq">FAQ</Link>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────  */}
        <div className="scr-cta-box">
          <div className="scr-cta-eyebrow">▸ WRITE YOUR FIRST SCRIPT</div>
          <h3 className="scr-cta-h">Included on every seat. No extra cost.</h3>
          <p>
            Scripts live in the dialer, not in a separate tab you have to
            keep switching to.
          </p>
          <a href={isSignedIn ? '/dashboard/dialer' : '/sign-up'} className="scr-cta-btn">
            {isSignedIn ? 'GO TO DIALER →' : 'GET STARTED →'}
          </a>
        </div>
      </article>
    </div>
  )
}
