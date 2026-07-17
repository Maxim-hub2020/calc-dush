import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

const removeLegacyServiceWorker = async () => {
  const hadController = Boolean(navigator.serviceWorker.controller)
  const registrations = await navigator.serviceWorker.getRegistrations()

  await Promise.all(registrations.map((registration) => registration.unregister()))

  if ('caches' in window) {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith('shower-calc-'))
        .map((cacheName) => caches.delete(cacheName)),
    )
  }

  if (!hadController) return

  const cleanupKey = 'shower-calc-service-worker-removed'
  if (sessionStorage.getItem(cleanupKey) === 'true') return

  sessionStorage.setItem(cleanupKey, 'true')
  window.location.reload()
}

if ('serviceWorker' in navigator && import.meta.env.PROD && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    void removeLegacyServiceWorker().catch(() => undefined)
  })
}
