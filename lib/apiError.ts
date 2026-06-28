import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

// Shared API error responder. Logs the FULL error server-side (console + Sentry)
// and returns a GENERIC, safe message to the client — so internal detail
// (table/column/constraint text, query fragments) never leaks over the wire.
// Keeps the same { success:false, error:<string> } shape routes already return.

interface ApiErrorOptions {
  route?: string
  status?: number
  clientMessage?: string
  context?: Record<string, unknown>
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

export function apiError(err: unknown, opts: ApiErrorOptions = {}): NextResponse {
  const status = opts.status ?? 500
  const route = opts.route ?? 'unknown'
  const clientMessage = opts.clientMessage ?? GENERIC_MESSAGE

  const detail = err instanceof Error ? (err.stack || err.message) : String(err)
  console.error(`[api:${route}] error:`, detail, opts.context ?? '')

  try {
    Sentry.captureException(err, { tags: { route }, extra: opts.context })
  } catch {
    // Sentry not initialized — console.error above already captured it.
  }

  return NextResponse.json({ success: false, error: clientMessage }, { status })
}

export function apiUnauthorized(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 401 })
}
