const CACHE = 'xpost-v1'

// Nie cachujemy index.html — zawsze pobieramy świeżą wersję
self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // index.html i nawigacja — zawsze z sieci (nigdy z cache)
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')))
    return
  }

  // Pozostałe zasoby (JS, CSS, ikony) — cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return response
      })
    })
  )
})
