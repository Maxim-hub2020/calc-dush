const cacheName = 'shower-calc-__BUILD_COMMIT__'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith('shower-calc-') || name === cacheName)
        .map((name) => caches.delete(name)),
    )

    await self.clients.claim()

    const windowClients = await self.clients.matchAll({ type: 'window' })
    await Promise.allSettled(windowClients.map((client) => client.navigate(client.url)))
  })())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(fetch(event.request))
})
