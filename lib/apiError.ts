// lib/apiError.ts
// =============================================================================
// Shared API error responder — keeps internal error detail OFF the wire.
// =============================================================================
// THE PROBLEM:
//   ~79 routes did `return NextResponse.json({ error: error.message }, { 500 })`.
//   Raw error.message leaks internals to the browser — table/column names,
//   constraint text, even fragments of failing queries — which is reconnaissance
//   for an attacker and noise for a user.
//
// THE FIX:
//   apiError() logs the FULL error server-side (console + Sentry, which is
//   already wired via instrumentation.ts) and returns a GENERIC, safe message
//   to the client. The response keeps the SAME shape the routes already use
//   ({ success: false, error: <string> }), so adopting it doesn't change any
//   client that reads `data.error`.
//
// USAGE:
//   } catch (err) {
//     return apiError(err, { route: 'campaigns/create' })
//   }
//
//   // Need a specific status or a client-safe message? Pass options:
//   return apiError(err, { route: 'leads/upload', status: 400,
//                          clientMessage: 'That file could not be parsed.' })
//
// The clientMessage you pass is shown verbatim (you control it). The underlying
// err is NEVER sent to the client — only logged.
// =============================================================================

import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

interface ApiErrorOptions {
  /** Stable label for where this failed, e.g. 'campaigns/create'. Logged + tagged. */
  route?: string
  /** HTTP status to return. Defaults to 500. */
  status?: number
  /**
   * A safe, user-facing message. Shown to the client verbatim. Defaults to a
   * generic string. NEVER pass raw error text here.
   */
  clientMessage?: string
  /** Extra non-sensitive context to attach to the server-side log/Sentry. */
  context?: Record<string, unknown>
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

/**
 * Log an error fully (server-side + Sentry) and return a NextResponse that
 * exposes only a generic, safe message to the client.
 */
export function apiError(err: unknown, opts: ApiErrorOptions = {}): NextResponse {
  const status = opts.status ?? 500
  const route = opts.route ?? 'unknown'
  const clientMessage = opts.clientMessage ?? GENERIC_MESSAGE

  const detail = err instanceof Error ? (err.stack || err.message) : String(err)

  // Full detail stays server-side.
  console.error(`[api:${route}] error:`, detail, opts.context ?? '')

  // Report to Sentry with route tag + safe context (best-effort; never throws).
  try {
    Sentry.captureException(err, {
      tags: { route },
      extra: opts.context,
    })
  } catch {
    // Sentry not initialized / failed — logging above already happened.
  }

  return NextResponse.json(
    { success: false, error: clientMessage },
    { status }
  )
}

/**
 * Convenience for the very common "unauthorized" case, so routes don't reinvent
 * the shape. Returns 401 with a safe message; logs nothing (not an error).
 */
export function apiUnauthorized(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 401 })
}
