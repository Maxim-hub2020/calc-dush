import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PublicCalculator from './PublicCalculator.tsx'

const isPublicCalculator = window.location.hostname === 'amalgama.cehcrm.ru'
  || window.location.pathname.startsWith('/public-calculator')
  || window.location.pathname.startsWith('/calculator')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPublicCalculator ? <PublicCalculator /> : <App />}
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

if (!isPublicCalculator && 'serviceWorker' in navigator && import.meta.env.PROD && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    void removeLegacyServiceWorker().catch(() => undefined)
  })
}
