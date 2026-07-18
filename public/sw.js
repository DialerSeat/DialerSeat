// DialerSeat service worker — handles Web Push for the admin
// Settings > Notifications feature. This file is intentionally minimal:
// its only job is to receive a push payload and show it as a real system
// notification, then focus/open the app on tap.
//
// Registered from the client the first time an admin turns on push in
// Settings (see components/admin-desktop/apps/Settings.tsx).

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (err) {
    payload = { title: 'DialerSeat', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'DialerSeat'
  const options = {
    body: payload.body || '',
    icon: '/icons/android-chrome-192x192.png',
    badge: '/icons/android-chrome-maskable-192x192.png',
    tag: payload.tag || undefined,       // same tag replaces a prior unread notification of the same kind
    data: { url: payload.url || '/dashboard/admin/desktop' },
    timestamp: Date.now(),
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard/admin/desktop'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
