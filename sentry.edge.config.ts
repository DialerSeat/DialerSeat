// sentry.edge.config.ts
// Runs in Edge Runtime — your proxy.ts (middleware) executes here.
// Lighter than the Node config because the Edge runtime has fewer APIs.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,

  enabled: process.env.NODE_ENV === 'production',

  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
})