import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {
  /* config options here */

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Report-only CSP first — see notes before enforcing
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://js.stripe.com https://challenges.cloudflare.com",
              "connect-src 'self' https://*.clerk.accounts.dev https://api.stripe.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
              "frame-src https://js.stripe.com https://challenges.cloudflare.com https://*.clerk.accounts.dev",
              "img-src 'self' data: https:",
              "style-src 'self' 'unsafe-inline'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // Sentry org + project — come from env vars at build time
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for uploading source maps to Sentry
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print upload logs in CI (Vercel sets CI=1), quiet in local builds
  silent: !process.env.CI,

  // Source map handling — uploaded to Sentry, deleted from public bundle
  // after upload so they aren't served to browsers
  sourcemaps: {
    disable: false,
    deleteSourcemapsAfterUpload: true,
  },

  // Disable Sentry's bundler telemetry
  telemetry: false,

  // Tree-shake unused Sentry features from the client bundle
  disableLogger: true,
})