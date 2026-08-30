import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

const supabase = getServiceClient('unsubscribe')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// /u/[token] — the unsubscribe link
// =============================================================================
// Public on purpose. Requiring a login to unsubscribe is both a CAN-SPAM
// failure and a deliverability one: someone who cannot get out of a list
// reaches for "report spam" instead, and a complaint costs far more than an
// opt-out ever does.
//
// WHY GET DOES NOT UNSUBSCRIBE. Outlook Safe Links, corporate mail scanners and
// several clients FETCH every URL in a message before a human sees it. A GET
// that mutates would quietly suppress contacts nobody ever clicked, and the
// symptom — a list that silently shrinks — looks like anything but this.
//
// So GET renders a confirm button and POST performs the opt-out. That also
// happens to be exactly what RFC 8058 one-click wants: Gmail and Yahoo POST
// `List-Unsubscribe=One-Click` to this same URL, which lands on the same
// handler and takes the same path.
//
// Headers the sending tool must set for one-click to work at all:
//   List-Unsubscribe: <https://dialerseat.com/u/TOKEN>
//   List-Unsubscribe-Post: List-Unsubscribe=One-Click
// =============================================================================

function page(title: string, body: string, tokenForForm?: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${title} — DialerSeat</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
         background:#f6f7f9; color:#14181f; padding:24px; }
  @media (prefers-color-scheme: dark) { body { background:#0c0f14; color:#e7ecf3; } }
  .card { max-width:420px; width:100%; text-align:center;
          background:#fff; border-radius:10px; padding:32px 28px;
          box-shadow:0 1px 3px rgba(0,0,0,.10); }
  @media (prefers-color-scheme: dark) { .card { background:#151a22; box-shadow:none; } }
  h1 { font-size:17px; margin:0 0 10px; letter-spacing:.2px; }
  p { font-size:14px; line-height:1.6; margin:0 0 18px; opacity:.78; }
  button { font:inherit; font-size:14px; cursor:pointer; padding:10px 20px;
           border:0; border-radius:6px; background:#14181f; color:#fff; }
  @media (prefers-color-scheme: dark) { button { background:#e7ecf3; color:#14181f; } }
  .brand { margin-top:22px; font-size:11px; letter-spacing:1.4px; opacity:.45; }
</style>
</head><body><div class="card">
<h1>${title}</h1>
<p>${body}</p>
${tokenForForm ? `<form method="POST" action="/u/${tokenForForm}"><button type="submit">Unsubscribe me</button></form>` : ''}
<div class="brand">DIALERSEAT</div>
</div></body></html>`
}

const html = (body: string, status = 200) =>
  new NextResponse(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const { data } = await supabase
    .from('outreach_contacts')
    .select('email, status')
    .eq('unsubscribe_token', token)
    .maybeSingle()

  if (!data) {
    // Neutral wording for an unknown or already-rotated token. Saying "no such
    // link" invites someone to go looking for one that works, and there is
    // nothing useful a person can do with the distinction anyway.
    return html(page('Nothing to do here', 'This link is no longer active. You will not be emailed from this list.'))
  }

  if (data.status === 'unsubscribed') {
    return html(page('Already unsubscribed', `${escapeHtml(data.email)} has been removed. Nothing further is needed.`))
  }

  return html(page(
    'Unsubscribe',
    `Remove <strong>${escapeHtml(data.email)}</strong> from DialerSeat outreach? This is permanent and takes effect immediately.`,
    token,
  ))
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const { data } = await supabase
    .from('outreach_contacts')
    .select('email')
    .eq('unsubscribe_token', token)
    .maybeSingle()

  // A missing token still returns 200. One-click senders read a non-2xx as a
  // broken unsubscribe and penalise the sender for it, and there is nothing to
  // retry — the address is not on the list either way.
  if (!data) {
    return html(page('Unsubscribed', 'You will not be emailed from this list again.'))
  }

  // Suppression is the record that matters; the trigger on this table marks the
  // contact. Ignoring a duplicate keeps a double-click idempotent.
  const { error } = await supabase
    .from('outreach_suppression')
    .upsert(
      { email: data.email, reason: 'unsubscribed', source: 'one-click' },
      { onConflict: 'email', ignoreDuplicates: true },
    )

  if (error) {
    console.error('[unsubscribe] failed to suppress', error)
    return html(page(
      'Something went wrong',
      'We could not process that automatically. Reply to the email you received and it will be handled by hand.',
    ), 500)
  }

  return html(page('Unsubscribed', `${escapeHtml(data.email)} has been removed. You will not hear from this list again.`))
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}
