/* ============================================================
   firebase-messaging-sw.js — Service Worker DLA POWIADOMIEŃ PUSH (FCM)
   XPost Manager. Osobny od sw.js (ten zostaje network-first, nietknięty).
   Zarejestrowany z main.js w wąskim scope '/firebase-cloud-messaging-push-scope/'.
   MUSI leżeć w katalogu głównym (root) i być dostępny pod /firebase-messaging-sw.js
   ============================================================ */

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js')

// ── KONFIGURACJA ────────────────────────────────────────────────
// WKLEJ tu obiekt firebaseConfig z Twojego firebase.js.
// Znane wartości projektu xpost-manager już wpisane —
// uzupełnij TYLKO apiKey i appId (z firebase.js / Firebase Console → Project settings).
firebase.initializeApp({
  apiKey:            'AIzaSyCZWF2AVCYuv-_XYNK7dU0yd1uEn5Rs9IU',
  authDomain:        'xpost-manager-e481d.firebaseapp.com',
  projectId:         'xpost-manager-e481d',
  storageBucket:     'xpost-manager-e481d.appspot.com',
  messagingSenderId: '686782658357',
  appId:             '1:686782658357:web:18d93f706ff37201fb3e7c'
})

const messaging = firebase.messaging()

// ── PUSH W TLE (aplikacja zamknięta / w tle) ────────────────────
messaging.onBackgroundMessage(payload => {
  const n = payload.notification || {}
  const d = payload.data || {}
  const title = n.title || d.title || 'XPost Manager'
  const options = {
    body: n.body || d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || undefined,          // ten sam tag = nie spamuje duplikatami
    data: { url: d.url || '/' },
    requireInteraction: false
  }
  return self.registration.showNotification(title, options)
})

// ── KLIK W POWIADOMIENIE → otwórz/zfokusuj aplikację (deep-link) ──
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Jeśli apka już otwarta — zfokusuj i przenawiguj
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {})
          return client.focus()
        }
      }
      // Inaczej otwórz nowe okno
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})
