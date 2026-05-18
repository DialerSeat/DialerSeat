// sentry.client.config.ts
// Runs in the browser. Catches uncaught exceptions in React components,
// client-side fetch failures, and unhandled promise rejections.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring — sample 10% of transactions.
  // Lower than the default (100%) to stay well under free tier quota.
  // Bump to 1.0 temporarily when debugging a specific perf issue.
  tracesSampleRate: 0.1,

  // Session Replay disabled by default (uses quota fast + GDPR considerations).
  // Enable later if you need to debug a specific user flow.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Don't send errors from local dev — only production + Vercel preview deploys
  enabled: process.env.NODE_ENV === 'production',

  // Environment tag — distinguishes prod from preview in Sentry UI
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,

  // Filter out noise:
  ignoreErrors: [
    // Browser extension noise
    'top.GLOBALS',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    // Network errors when user closes tab mid-request — not actionable
    'Network request failed',
    'NetworkError when attempting to fetch resource',
    'Load failed',
    // Clerk session expiry — handled gracefully by the SDK
    'ClerkSessionExpired',
    // User navigated away
    'Non-Error promise rejection captured',
  ],

  // Strip out URLs we can't fix
  denyUrls: [
    /chrome-extension:/i,
    /moz-extension:/i,
    /safari-extension:/i,
    /^chrome:\/\//i,
  ],
})