import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {

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