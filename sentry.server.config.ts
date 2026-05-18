// sentry.server.config.ts
// Runs in Node serverless functions (every API route, server component,
// server action). This is where Stripe webhook errors, DB errors, and
// SignalWire callback errors get captured.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,

  enabled: process.env.NODE_ENV === 'production',

  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

  // Server-side noise filters
  ignoreErrors: [
    // Vercel cron auth rejections — expected when CRON_SECRET is wrong;
    // not a Sentry-worthy event
    'unauthorized',
    // Stripe signature verification failures — these are attacks/misconfig,
    // not bugs. Log them via console.error, not Sentry.
    'No signatures found matching the expected signature',
    'Webhook signature verification failed',
    // Supabase "no rows" results aren't errors
    'JSON object requested, multiple (or no) rows returned',
  ],

  // Scrub sensitive fields before sending. Sentry has built-in PII scrubbing
  // but we add explicit denylist for safety.
  beforeSend(event) {
    // Strip auth headers
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
      delete event.request.headers['stripe-signature']
    }
    return event
  },
})