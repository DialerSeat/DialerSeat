'use client'
import { useState } from 'react'
import { t } from '@/lib/i18n/client'
import { msg } from '@/lib/i18n/msg'

export interface TeamCode {
  id: string
  code: string
  code_type: 'seat' | 'recruit'
  payer: 'owner' | 'agent'
  campaign_id: string | null
  max_uses: number | null
  use_count: number
  seat_price_override_cents: number | null
  is_active: boolean
  created_at: string
}

export interface TeamCampaignRef {
  campaignId: string
  campaign: { id: string; name: string } | null
}

const FUTURA = "'Futura PT', Futura, sans-serif"
const T = {
  bg: 'var(--brand-page-bg, #f0f1f4)',
  surface: 'var(--brand-card-surface, #e2e4ea)',
  border: 'var(--brand-card-border, #c4c8d0)',
  text: 'var(--brand-on-page-bg, #1a1c24)',
  muted: 'var(--brand-muted-text, #5a5e6a)',
  primary: 'var(--brand-primary, #2a4a8a)',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

function linkFor(code: string): string {
  return `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${code}`
}

function campaignNameFor(refs: TeamCampaignRef[], campaignId: string | null): string {
  if (!campaignId) return msg("All campaigns")
  return refs.find(r => r.campaignId === campaignId)?.campaign?.name || msg("Unknown campaign")
}

function usageLabel(code: TeamCode): string {
  if (code.max_uses === 1) return code.use_count > 0 ? t("Used") : t("Unused, single use")
  if (code.max_uses === null) return t("{count} joined, unlimited", { count: code.use_count })
  return t("{uses} / {max} used", { uses: code.use_count, max: code.max_uses })
}

export default function SeatLinksPanel({
  teamId,
  codes,
  teamCampaigns,
  onChanged,
}: {
  teamId: string
  codes: TeamCode[]
  teamCampaigns: TeamCampaignRef[]
  onChanged: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [codeType, setCodeType] = useState<'seat' | 'recruit'>('seat')
  const [payer, setPayer] = useState<'owner' | 'agent'>('owner')
  const [singleUse, setSingleUse] = useState(true)
  const [campaignId, setCampaignId] = useState('')
  const [priceOverride, setPriceOverride] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justCreated, setJustCreated] = useState<TeamCode | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TeamCode | null>(null)
  const [deleting, setDeleting] = useState(false)

  const copy = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(code))
      setCopiedId(id)
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 2000)
    } catch {}
  }

  const resetForm = () => {
    setCodeType('seat')
    setPayer('owner')
    setSingleUse(true)
    setCampaignId('')
    setPriceOverride('')
    setError(null)
  }

  const handleCreate = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/teams/codes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          codeType,
          payer,
          campaignId: codeType === 'seat' && campaignId ? campaignId : undefined,
          singleUse,
          seatPriceOverrideCents:
            payer === 'owner' && priceOverride.trim()
              ? Math.round(parseFloat(priceOverride) * 100)
              : undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || msg("Could not create this link"))
        return
      }
      setJustCreated(data.code)
      setCreating(false)
      resetForm()
      onChanged()
    } catch (e: any) {
      setError(e.message || msg("Something went wrong"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch('/api/teams/codes/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId: deleteTarget.id, confirm: 'remove' }),
      })
      setDeleteTarget(null)
      onChanged()
    } catch {} finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ fontFamily: FUTURA, color: T.text }}>
      {justCreated && (
        <div style={{
          background: T.surface, border: `1px solid ${T.green}`, borderRadius: 6,
          padding: 20, marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 'bold', color: T.green, marginBottom: 10 }}>
            {t("✓ SEAT LINK CREATED, SHARE THIS")}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              readOnly
              value={linkFor(justCreated.code)}
              onFocus={e => e.target.select()}
              style={{
                flex: 1, padding: '10px 12px', background: T.bg, border: `1px solid ${T.border}`,
                borderRadius: 4, fontFamily: 'monospace', fontSize: 13, color: T.text,
              }}
            />
            <button onClick={() => copy(justCreated.id, justCreated.code)} style={primaryBtnStyle}>
              {copiedId === justCreated.id ? t("COPIED ✓") : t("COPY LINK")}
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: T.muted }}>
            {t("Whoever opens this link will be asked to confirm before joining, nothing happens until they accept.")}</div>
          <button onClick={() => setJustCreated(null)} style={dismissLinkStyle}>{t("Dismiss")}</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 'bold', color: T.muted }}>
          {t("▸ SEAT LINKS (")}{codes.filter(c => c.is_active).length})
        </div>
        {!creating && (
          <button onClick={() => { setCreating(true); setJustCreated(null) }} style={primaryBtnStyle}>
            {t("+ NEW SEAT LINK")}</button>
        )}
      </div>

      {creating && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: 20, marginBottom: 20 }}>
          <FieldLabel>{t("WHAT DOES THIS LINK DO?")}</FieldLabel>
          <SegmentedTwo
            value={codeType}
            onChange={v => setCodeType(v as 'seat' | 'recruit')}
            options={[
              { value: 'seat', label: msg("Grant campaign access") },
              { value: 'recruit', label: msg("Just join the roster") },
            ]}
          />

          {codeType === 'seat' && (
            <>
              <FieldLabel style={{ marginTop: 16 }}>{t("WHICH CAMPAIGN?")}</FieldLabel>
              <select
                value={campaignId}
                onChange={e => setCampaignId(e.target.value)}
                style={selectStyle}
              >
                <option value="">{t("All campaigns currently on this team")}</option>
                {teamCampaigns.map(tc => (
                  <option key={tc.campaignId} value={tc.campaignId}>
                    {tc.campaign?.name || t("Untitled campaign")}
                  </option>
                ))}
              </select>
            </>
          )}

          <FieldLabel style={{ marginTop: 16 }}>{t("WHO PAYS FOR THE SEAT?")}</FieldLabel>
          <SegmentedTwo
            value={payer}
            onChange={v => setPayer(v as 'owner' | 'agent')}
            options={[
              { value: 'owner', label: msg("You pay: instant access") },
              { value: 'agent', label: msg("They pay their own way") },
            ]}
          />

          {payer === 'owner' && (
            <div style={{ marginTop: 10, fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
              {t("Charged to your card the moment someone redeems a single-use link, they're set up and dialing without ever entering payment info.")}</div>
          )}
          {payer === 'agent' && (
            <div style={{ marginTop: 10, fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
              {t("They complete their own checkout before access turns on, nothing is billed to you.")}</div>
          )}

          {payer === 'owner' && (
            <>
              <FieldLabel style={{ marginTop: 16 }}>{t("PRICE OVERRIDE (OPTIONAL)")}</FieldLabel>
              <input
                type="number"
                step="0.01"
                placeholder={t("35.00 (default)")}
                value={priceOverride}
                onChange={e => setPriceOverride(e.target.value)}
                style={selectStyle}
              />
            </>
          )}

          <FieldLabel style={{ marginTop: 16 }}>{t("USES")}</FieldLabel>
          <SegmentedTwo
            value={singleUse ? 'single' : 'multi'}
            onChange={v => setSingleUse(v === 'single')}
            options={[
              { value: 'single', label: msg("One person, one link") },
              { value: 'multi', label: msg("Reusable: anyone with the link") },
            ]}
          />
          {!singleUse && payer === 'owner' && (
            <div style={{ marginTop: 10, fontSize: 12, color: T.amber, lineHeight: 1.5 }}>
              {t("Reusable owner-pays links need your manual approval per person before their access turns on, so charges don't happen without you seeing them first.")}</div>
          )}

          {error && <ErrorInline>{t(error)}</ErrorInline>}

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button onClick={handleCreate} disabled={submitting} style={{ ...primaryBtnStyle, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? t("CREATING…") : t("CREATE LINK")}
            </button>
            <button onClick={() => { setCreating(false); resetForm() }} style={subtleBtnStyle}>{t("CANCEL")}</button>
          </div>
        </div>
      )}

      {codes.length === 0 ? (
        <EmptyHint>{t("No seat links yet. Create one to invite an agent.")}</EmptyHint>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {codes.map(code => (
            <div key={code.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6,
              opacity: code.is_active ? 1 : 0.5,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge color={code.payer === 'owner' ? T.green : T.amber}>
                    {code.payer === 'owner' ? t("YOU PAY") : t("THEY PAY")}
                  </Badge>
                  <Badge color={T.muted}>{code.code_type === 'seat' ? t("SEAT") : t("ROSTER ONLY")}</Badge>
                  <Badge color={T.muted}>{code.max_uses === 1 ? t("SINGLE USE") : t("REUSABLE")}</Badge>
                </div>
                <div style={{ fontSize: 13, fontWeight: 'bold', marginTop: 6 }}>
                  {code.code_type === 'seat' ? campaignNameFor(teamCampaigns, code.campaign_id) : t("Roster only, no campaign yet")}
                </div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{usageLabel(code)}</div>
              </div>
              <button onClick={() => copy(code.id, code.code)} style={subtleBtnStyle}>
                {copiedId === code.id ? t("COPIED ✓") : t("COPY LINK")}
              </button>
              <button onClick={() => setDeleteTarget(code)} style={dangerBtnStyle}>{t("DELETE")}</button>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => !deleting && setDeleteTarget(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: 24, width: 360, maxWidth: '90vw' }}
          >
            <div style={{ fontSize: 13, fontWeight: 'bold', color: T.red, marginBottom: 10 }}>{t("DELETE THIS SEAT LINK?")}</div>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: T.muted, marginBottom: 20 }}>
              {t("This link stops working immediately. Anyone who already joined through it keeps their access, this only affects future use of the link itself.")}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={subtleBtnStyle}>{t("CANCEL")}</button>
              <button onClick={handleDelete} disabled={deleting} style={dangerBtnStyle}>
                {deleting ? t("DELETING…") : t("DELETE LINK")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FieldLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 'bold', color: T.muted, marginBottom: 8, ...style }}>{children}</div>
}

function SegmentedTwo({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: '10px 12px', borderRadius: 4, fontFamily: FUTURA, fontSize: 12,
            cursor: 'pointer', textAlign: 'start',
            background: value === opt.value ? T.primary : T.bg,
            color: value === opt.value ? 'white' : T.text,
            border: `1px solid ${value === opt.value ? T.primary : T.border}`,
          }}
        >{t(opt.label)}</button>
      ))}
    </div>
  )
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      fontSize: 9, letterSpacing: 1, fontWeight: 'bold', color, padding: '3px 7px',
      borderRadius: 2, border: `1px solid ${color}`,
    }}>{children}</span>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      textAlign: 'center', padding: '32px 16px', color: T.muted, fontSize: 13,
      border: `1px dashed ${T.border}`, borderRadius: 6,
    }}>{children}</div>
  )
}

function ErrorInline({ children }: { children: React.ReactNode }) {
  return <div style={{ marginTop: 12, fontSize: 12, color: T.red }}>{children}</div>
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: T.bg, border: `1px solid ${T.border}`,
  borderRadius: 4, fontFamily: FUTURA, fontSize: 13, color: T.text,
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 16px', background: T.primary, color: 'white', border: 'none',
  borderRadius: 4, fontSize: 11, letterSpacing: 1.5, fontWeight: 'bold',
  cursor: 'pointer', fontFamily: FUTURA, whiteSpace: 'nowrap',
}

const subtleBtnStyle: React.CSSProperties = {
  padding: '10px 16px', background: 'transparent', color: T.text, border: `1px solid ${T.border}`,
  borderRadius: 4, fontSize: 11, letterSpacing: 1.5, fontWeight: 'bold',
  cursor: 'pointer', fontFamily: FUTURA, whiteSpace: 'nowrap',
}

const dangerBtnStyle: React.CSSProperties = {
  padding: '10px 16px', background: 'transparent', color: T.red, border: `1px solid ${T.red}`,
  borderRadius: 4, fontSize: 11, letterSpacing: 1.5, fontWeight: 'bold',
  cursor: 'pointer', fontFamily: FUTURA, whiteSpace: 'nowrap',
}

const dismissLinkStyle: React.CSSProperties = {
  marginTop: 10, background: 'transparent', border: 'none', color: T.muted,
  fontSize: 11, cursor: 'pointer', fontFamily: FUTURA, padding: 0, textDecoration: 'underline',
}
