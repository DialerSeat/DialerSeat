import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Unit tests only, and deliberately so.
//
// The valuable tests in this codebase are over PURE functions that have
// already caused production incidents — phone normalization and the per-lead
// calling window. Both are plain input/output with no network, no database and
// no React, so they need no environment beyond node and run in milliseconds.
//
// `include` is an allowlist rather than a broad glob: it keeps a future
// component test from silently pulling in jsdom, Clerk and Supabase and
// turning a fast suite into a slow flaky one.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
