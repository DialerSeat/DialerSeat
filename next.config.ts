import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {

  // ── WHICH BUILD THE BROWSER IS RUNNING ──────────────────────────────────
  // VERCEL_GIT_COMMIT_SHA is a SERVER variable. `env` inlines it into the
  // client bundle at build time, which is what lets a long-lived dialer tab
  // report the code it is actually running -- see lib/buildId.ts for why that
  // matters and why NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA was not used instead.
  //
  // Empty outside Vercel; buildId.ts turns that into 'dev'.
  env: {
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA || '',
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },

          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://js.stripe.com https://challenges.cloudflare.com",
              // wss://*.telnyx.com is REQUIRED, not optional: the browser
              // softphone carries SIP signalling over a WebSocket to
              // sip.telnyx.com:7443. This policy is Report-Only today, so the
              // omission was invisible — but switching it to enforcing
              // without this entry blocks that socket and the dialer stops
              // placing calls entirely, with the only clue being a CSP
              // message in a console nobody has open during a shift.
              "connect-src 'self' https://*.clerk.accounts.dev https://api.stripe.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io wss://*.telnyx.com https://*.telnyx.com",
              "frame-src https://js.stripe.com https://challenges.cloudflare.com https://*.clerk.accounts.dev",
              "img-src 'self' data: https:",
              // app/globals.css imports Futura PT from fonts.cdnfonts.com.
              // style-src covers the @import'd stylesheet; font-src covers the
              // font files it then references — without BOTH, enforcing this
              // policy drops the site's typeface everywhere.
              "style-src 'self' 'unsafe-inline' https://fonts.cdnfonts.com",
              "font-src 'self' data: https://fonts.cdnfonts.com",
            ].join('; '),
          },
        ],
      },
    ]
  },

  async redirects() {
    return [
      {

        source: '/security.txt',
        destination: '/.well-known/security.txt',
        permanent: true,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: !process.env.CI,

  sourcemaps: {
    disable: false,
    deleteSourcemapsAfterUpload: true,
  },

  telemetry: false,

  disableLogger: true,
})