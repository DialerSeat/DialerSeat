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

export default function CampaignsFaqView() {
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
        .cmp-root { max-width: 820px; margin: 0 auto; padding: 80px 32px 120px; }
        .cmp-eyebrow {
          font-size: 11px; letter-spacing: 4px; color: ${T.muted};
          font-weight: bold; margin-bottom: 18px;
        }
        .cmp-h1 {
          font-size: 42px; line-height: 1.15; letter-spacing: -0.5px;
          font-weight: 700; margin: 0 0 24px 0;
        }
        .cmp-h1 em { font-style: normal; color: ${T.blue}; }
        .cmp-deck {
          font-size: 19px; line-height: 1.6; color: ${T.muted};
          margin-bottom: 40px; max-width: 680px;
        }
        .cmp-badge-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 56px; }
        .cmp-badge {
          padding: 8px 16px; border-radius: 20px; font-size: 12px;
          font-weight: bold; letter-spacing: 1px; border: 1px solid ${T.border};
          background: white; color: ${T.text};
        }
        .cmp-badge.hi { background: ${T.dark}; color: #7ab8ff; border-color: ${T.dark}; }

        .cmp-section { margin: 56px 0; }
        .cmp-section h2 {
          font-size: 13px; letter-spacing: 3px; font-weight: bold;
          color: ${T.accent}; margin: 0 0 18px 0;
          padding-bottom: 10px; border-bottom: 1px solid ${T.border};
        }
        .cmp-section h3 {
          font-size: 22px; line-height: 1.3; font-weight: 700;
          margin: 28px 0 14px 0; letter-spacing: -0.2px;
        }
        .cmp-section p {
          font-size: 16px; line-height: 1.75; margin: 0 0 18px 0;
          color: ${T.text};
        }
        .cmp-section p.muted { color: ${T.muted}; font-size: 15px; }
        .cmp-section strong { color: ${T.text}; font-weight: 700; }
        .cmp-section em { font-style: italic; color: ${T.accent}; }
        .cmp-section ul { margin: 14px 0 24px 0; padding-left: 22px; }
        .cmp-section li { font-size: 16px; line-height: 1.75; margin-bottom: 8px; }
        .cmp-section code {
          background: ${T.surface}; padding: 1px 6px; border-radius: 3px;
          font-size: 13.5px; font-family: monospace;
        }

        /* SETTINGS TABLE */
        .cmp-settings-table { margin: 20px 0 8px; border: 1px solid ${T.border}; border-radius: 8px; overflow: hidden; background: white; }
        .cmp-settings-row { display: grid; grid-template-columns: 180px 1fr; }
        .cmp-settings-row + .cmp-settings-row { border-top: 1px solid ${T.border}; }
        .cmp-settings-row.head { background: ${T.dark}; }
        .cmp-settings-cell { padding: 13px 16px; font-size: 14px; line-height: 1.6; }
        .cmp-settings-row.head .cmp-settings-cell {
          color: white; font-size: 10.5px; letter-spacing: 2px; font-weight: bold;
        }
        .cmp-settings-cell.name { font-weight: 700; color: ${T.text}; background: ${T.surface}; font-size: 13px; }
        .cmp-settings-cell code { background: transparent; padding: 0; font-size: 12.5px; }

        /* AMD DEFAULTS GRID */
        .cmp-amd-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0 8px; }
        .cmp-amd-card { background: white; border: 1px solid ${T.border}; border-radius: 8px; padding: 16px 14px; text-align: center; }
        .cmp-amd-mode { font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px; color: ${T.text}; }
        .cmp-amd-state { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 12px; display: inline-block; }
        .cmp-amd-state.on { background: #e8f5e8; color: ${T.green}; }
        .cmp-amd-state.off { background: #f0f1f4; color: ${T.muted}; }

        /* FLOW LIST */
        .cmp-flow { display: flex; flex-direction: column; gap: 0; margin: 24px 0 8px; }
        .cmp-flow-step {
          display: flex; gap: 16px; padding: 14px 0; align-items: flex-start;
          border-left: 2px solid ${T.border}; padding-left: 22px; margin-left: 15px;
          position: relative;
        }
        .cmp-flow-step::before {
          content: ''; position: absolute; left: -7px; top: 18px;
          width: 12px; height: 12px; border-radius: 50%;
          background: ${T.accent}; border: 2px solid white;
        }
        .cmp-flow-step:last-child { border-left: 2px solid transparent; }
        .cmp-flow-body h4 { font-size: 15px; margin: 0 0 4px 0; font-weight: 700; }
        .cmp-flow-body p { font-size: 14px; line-height: 1.6; margin: 0; color: ${T.muted}; }

        .cmp-callout {
          margin: 32px 0; padding: 22px 26px; background: ${T.surface};
          border-left: 3px solid ${T.blue}; border-radius: 4px;
        }
        .cmp-callout p { font-size: 15px; line-height: 1.7; margin: 0; color: ${T.text}; }
        .cmp-callout strong { color: ${T.accent}; }

        .cmp-related {
          margin-top: 48px; padding-top: 28px; border-top: 1px solid ${T.border};
        }
        .cmp-related-label {
          font-size: 10px; letter-spacing: 3px; color: ${T.muted};
          font-weight: bold; margin-bottom: 14px;
        }
        .cmp-related-links { display: flex; gap: 24px; flex-wrap: wrap; }
        .cmp-related-links a {
          font-size: 13px; color: ${T.accent}; text-decoration: none;
          border-bottom: 1px solid transparent; padding-bottom: 1px;
          transition: border-color 0.15s;
        }
        .cmp-related-links a:hover { border-bottom-color: ${T.accent}; }

        .cmp-cta-box {
          margin-top: 56px; padding: 40px 36px; background: ${T.dark};
          border-radius: 8px; text-align: center;
        }
        .cmp-cta-box .cmp-cta-eyebrow {
          font-size: 10px; letter-spacing: 4px; color: #7ab8ff;
          font-weight: bold; margin-bottom: 14px;
        }
        .cmp-cta-box .cmp-cta-h {
          font-size: 26px; color: white; font-weight: 700;
          margin: 0 0 12px 0; letter-spacing: -0.2px;
        }
        .cmp-cta-box p { font-size: 15px; color: #c0c2ca; line-height: 1.6; margin: 0 0 28px 0; }
        .cmp-cta-box .cmp-cta-btn {
          display: inline-block; padding: 16px 36px;
          background: linear-gradient(135deg, #4a9eff, #2a6eff);
          border: none; border-radius: 6px; color: white;
          font-size: 12px; font-weight: bold; letter-spacing: 3px;
          text-decoration: none; font-family: 'Futura PT', Futura, sans-serif;
          box-shadow: 0 0 24px rgba(74,158,255,0.3);
        }

        @media (max-width: 768px) {
          .cmp-root { padding: 48px 20px 80px; }
          .cmp-h1 { font-size: 28px; }
          .cmp-deck { font-size: 16px; }
          .cmp-section h3 { font-size: 19px; }
          .cmp-section p, .cmp-section li { font-size: 15px; }
          .cmp-settings-row { grid-template-columns: 130px 1fr; }
          .cmp-settings-cell { font-size: 12.5px; padding: 10px 12px; }
          .cmp-amd-grid { grid-template-columns: repeat(2, 1fr); }
          .cmp-cta-box { padding: 32px 24px; }
          .cmp-cta-box .cmp-cta-h { font-size: 22px; }
        }
      `}</style>

      <article className="cmp-root">
        <div className="cmp-eyebrow">▸ SETTING UP A CAMPAIGN</div>

        <h1 className="cmp-h1">
          A campaign is just a mode, a list, and a script. <em>That&apos;s it.</em>
        </h1>

        <p className="cmp-deck">
          No wizard, no required setup flow, no fields you&apos;re forced
          to fill in before you can dial. Create one, it&apos;s active
          immediately, and every setting below has a sane default so you
          can start dialing before you&apos;ve touched a single toggle.
        </p>

        <div className="cmp-badge-row">
          <span className="cmp-badge hi">ACTIVE THE MOMENT YOU CREATE IT</span>
          <span className="cmp-badge">EVERY SETTING HAS A DEFAULT</span>
          <span className="cmp-badge">EDITABLE ANY TIME</span>
        </div>

        {/* ── THE SETTINGS ───────────────────────────────────────────────── */}
        <section className="cmp-section">
          <h2>▸ THE ACTUAL SETTINGS ON A CAMPAIGN</h2>
          <p>
            This is the complete list — nothing hidden behind a
            &ldquo;advanced&rdquo; tab you have to go find:
          </p>

          <div className="cmp-settings-table">
            <div className="cmp-settings-row head">
              <div className="cmp-settings-cell">SETTING</div>
              <div className="cmp-settings-cell">WHAT IT CONTROLS</div>
            </div>
            <div className="cmp-settings-row">
              <div className="cmp-settings-cell name">Name</div>
              <div className="cmp-settings-cell">Whatever you want. Leave it blank and it becomes &ldquo;Untitled,&rdquo; &ldquo;Untitled (1),&rdquo; and so on — never a blank or duplicate name.</div>
            </div>
            <div className="cmp-settings-row">
              <div className="cmp-settings-cell name">Dialer mode</div>
              <div className="cmp-settings-cell"><code>preview</code>, <code>power</code>, <code>progressive</code>, or <code>predictive</code>. Defaults to <strong>power</strong> if you don&apos;t set one. See <Link href="/faq/dialer-modes">dialer modes explained</Link>.</div>
            </div>
            <div className="cmp-settings-row">
              <div className="cmp-settings-cell name">AMD toggle</div>
              <div className="cmp-settings-cell">On or off, your choice, on every mode. Defaults on for progressive and predictive, off for power and preview — a starting point, not a restriction. See <Link href="/faq/how-does-amd-work">how AMD works</Link>.</div>
            </div>
            <div className="cmp-settings-row">
              <div className="cmp-settings-cell name">Lines per agent</div>
              <div className="cmp-settings-cell">Predictive-only. A multiplier between <code>1.0</code> and <code>3.0</code>, defaulting to <code>1.5</code>. Higher means more aggressive pacing; the abandon-rate auto-degrade still applies regardless of where you set it.</div>
            </div>
            <div className="cmp-settings-row">
              <div className="cmp-settings-cell name">Voicemail drop URL</div>
              <div className="cmp-settings-cell">Optional audio file. When AMD detects a machine, this plays instead of an agent leaving a live message — set it once, it fires automatically from then on.</div>
            </div>
            <div className="cmp-settings-row">
              <div className="cmp-settings-cell name">Status</div>
              <div className="cmp-settings-cell"><code>active</code> or <code>inactive</code>. New campaigns start active — there&apos;s no draft state you have to publish out of.</div>
            </div>
          </div>
        </section>

        {/* ── AMD DEFAULTS ───────────────────────────────────────────────── */}
        <section className="cmp-section">
          <h2>▸ THE AMD DEFAULT, MODE BY MODE</h2>
          <p>
            AMD is a toggle available on every dialer mode — it&apos;s
            never locked on or locked off. What changes by mode is only
            the starting position when you first create a campaign:
          </p>

          <div className="cmp-amd-grid">
            <div className="cmp-amd-card">
              <div className="cmp-amd-mode">PREVIEW</div>
              <span className="cmp-amd-state off">OFF BY DEFAULT</span>
            </div>
            <div className="cmp-amd-card">
              <div className="cmp-amd-mode">POWER</div>
              <span className="cmp-amd-state off">OFF BY DEFAULT</span>
            </div>
            <div className="cmp-amd-card">
              <div className="cmp-amd-mode">PROGRESSIVE</div>
              <span className="cmp-amd-state on">ON BY DEFAULT</span>
            </div>
            <div className="cmp-amd-card">
              <div className="cmp-amd-mode">PREDICTIVE</div>
              <span className="cmp-amd-state on">ON BY DEFAULT</span>
            </div>
          </div>

          <p className="muted" style={{ marginTop: 16 }}>
            Flip it either direction on any campaign, any time — the
            defaults exist so a fresh campaign starts in a sensible state,
            not because a mode requires a specific setting.
          </p>
        </section>

        {/* ── HOW A CAMPAIGN COMES TOGETHER ──────────────────────────────── */}
        <section className="cmp-section">
          <h2>▸ THE ACTUAL ORDER MOST PEOPLE SET ONE UP</h2>

          <div className="cmp-flow">
            <div className="cmp-flow-step">
              <div className="cmp-flow-body">
                <h4>1. CREATE THE CAMPAIGN</h4>
                <p>Name it, pick a mode (or leave it on power). It&apos;s live immediately.</p>
              </div>
            </div>
            <div className="cmp-flow-step">
              <div className="cmp-flow-body">
                <h4>2. UPLOAD LEADS</h4>
                <p>Drop in a spreadsheet — see <Link href="/faq/leads">uploading &amp; managing leads</Link> for the full field reference.</p>
              </div>
            </div>
            <div className="cmp-flow-step">
              <div className="cmp-flow-body">
                <h4>3. ATTACH A SCRIPT (OPTIONAL)</h4>
                <p>Toggle on any script you or your team already wrote — see <Link href="/faq/scripts">call scripts</Link>. Skip this step entirely if you don&apos;t use scripts.</p>
              </div>
            </div>
            <div className="cmp-flow-step">
              <div className="cmp-flow-body">
                <h4>4. ADJUST MODE-SPECIFIC SETTINGS</h4>
                <p>AMD toggle, lines-per-agent if predictive, voicemail drop if you have an audio file ready. All optional, all editable later.</p>
              </div>
            </div>
            <div className="cmp-flow-step">
              <div className="cmp-flow-body">
                <h4>5. DIAL</h4>
                <p>Select the campaign from the dialer terminal and go available. Nothing else is required.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── HONEST NOTE ───────────────────────────────────────────────── */}
        <div className="cmp-callout">
          <p>
            <strong>One thing worth knowing —</strong> every setting on
            this page is editable after the fact, including dialer mode.
            Switching a live campaign from power to predictive mid-run
            doesn&apos;t require pausing it or re-uploading leads — the
            leads already in the queue just start getting dialed under
            the new mode&apos;s pacing rules.
          </p>
        </div>

        {/* ── RELATED ────────────────────────────────────────────────────── */}
        <div className="cmp-related">
          <div className="cmp-related-label">▸ RELATED READING</div>
          <div className="cmp-related-links">
            <Link href="/faq/dialer-modes">Dialer modes explained</Link>
            <Link href="/faq/leads">Uploading &amp; managing leads</Link>
            <Link href="/faq/scripts">Call scripts</Link>
            <Link href="/faq/how-does-amd-work">How AMD works</Link>
            <Link href="/faq">FAQ</Link>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────  */}
        <div className="cmp-cta-box">
          <div className="cmp-cta-eyebrow">▸ CREATE YOUR FIRST CAMPAIGN</div>
          <h3 className="cmp-cta-h">$35/week. No setup wizard, no required fields.</h3>
          <p>
            Name it or don&apos;t — you&apos;ll be dialing in under a
            minute either way.
          </p>
          <a href={isSignedIn ? '/dashboard/campaigns' : '/sign-up'} className="cmp-cta-btn">
            {isSignedIn ? 'GO TO CAMPAIGNS →' : 'GET STARTED →'}
          </a>
        </div>
      </article>
    </div>
  )
}
