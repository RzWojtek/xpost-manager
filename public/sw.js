const CACHE = 'xpost-v2'
const STATIC = ['/', '/index.html']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  // Zawsze próbuj pobrać świeżą wersję z sieci
  // Cache tylko jako fallback gdy brak połączenia
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Zapisz świeżą wersję do cache
        const clone = response.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return response
      })
      .catch(() => caches.match(e.request))
  )
})
