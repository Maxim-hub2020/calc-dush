const cacheName = 'shower-calc-__BUILD_COMMIT__'
const appShellUrls = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/pwa-180.png',
  '/pwa-192.png',
  '/pwa-512.png',
  '/pwa-maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName)

    await Promise.allSettled(appShellUrls.map(async (url) => {
      const response = await fetch(url, { cache: 'reload' })
      if (response.ok) await cache.put(url, response)
    }))

    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith('shower-calc-') && name !== cacheName)
        .map((name) => caches.delete(name)),
    )

    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname === '/version.json') return

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request)
        if (response.ok) {
          const cache = await caches.open(cacheName)
          await cache.put('/index.html', response.clone())
        }
        return response
      } catch {
        return (await caches.match('/index.html')) || Response.error()
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cachedResponse = await caches.match(event.request)
    if (cachedResponse) return cachedResponse

    const response = await fetch(event.request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      await cache.put(event.request, response.clone())
    }
    return response
  })())
})
