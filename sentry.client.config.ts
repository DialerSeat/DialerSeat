



import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  
  
  
  tracesSampleRate: 0.1,

  
  
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  
  enabled: process.env.NODE_ENV === 'production',

  
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,

  
  ignoreErrors: [
    
    'top.GLOBALS',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    
    'Network request failed',
    'NetworkError when attempting to fetch resource',
    'Load failed',
    
    'ClerkSessionExpired',
    
    'Non-Error promise rejection captured',
  ],

  
  denyUrls: [
    /chrome-extension:/i,
    /moz-extension:/i,
    /safari-extension:/i,
    /^chrome:\/\//i,
  ],
})