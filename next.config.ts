import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {
  /* config options here */
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