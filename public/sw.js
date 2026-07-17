const cacheName = 'shower-calc-__BUILD_COMMIT__'
const appShell = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']
const optionalAssets = [
  '/assets/pdfmake-v0.3.11.js',
  '/assets/pdfmake-fonts-v0.3.11.js',
]

const unavailableResponse = () => new Response('Ресурс временно недоступен', {
  status: 503,
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
})

const cacheResponse = async (request, response) => {
  const cache = await caches.open(cacheName)
  await cache.put(request, response)
}

const matchCached = async (request) => {
  try {
    const cache = await caches.open(cacheName)
    return await cache.match(request)
  } catch {
    return undefined
  }
}

const isExpectedContentType = (request, response) => {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (request.destination === 'script') return contentType.includes('javascript')
  if (request.destination === 'style') return contentType.includes('text/css')
  return true
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName)
    await cache.addAll(appShell)
    await Promise.allSettled(optionalAssets.map((asset) => cache.add(asset)))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request)
      if (!response.ok || !isExpectedContentType(event.request, response)) {
        throw new Error(`Unexpected response: ${response.status}`)
      }
      event.waitUntil(cacheResponse(event.request, response.clone()).catch(() => undefined))
      return response
    } catch {
      const cached = await matchCached(event.request)
      if (cached) return cached

      if (event.request.mode === 'navigate') {
        return (await matchCached('/index.html')) ?? unavailableResponse()
      }

      return unavailableResponse()
    }
  })())
})
