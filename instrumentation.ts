// instrumentation.ts
// Next.js auto-runs this file once per runtime initialization.
// It loads the correct Sentry config based on the runtime (Node vs Edge).
// Lives at repo root, NOT inside /app.

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Capture errors that bubble up from request handlers
export const onRequestError = async (
  err: unknown,
  request: {
    path: string
    method: string
    headers: { [key: string]: string | string[] | undefined }
  },
  context: {
    routerKind: 'Pages Router' | 'App Router'
    routePath: string
    routeType: 'render' | 'route' | 'action' | 'middleware'
  }
) => {
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureRequestError(err, request, context)
}