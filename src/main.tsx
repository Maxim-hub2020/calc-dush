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

const registerServiceWorker = async () => {
  let isReloading = false
  document.documentElement.dataset.pwaStatus = 'installing'

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isReloading) return
    isReloading = true
    window.location.reload()
  })

  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  })

  await registration.update()
  await navigator.serviceWorker.ready
  document.documentElement.dataset.pwaStatus = 'ready'
}

if (!isPublicCalculator && 'serviceWorker' in navigator && import.meta.env.PROD && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    void registerServiceWorker().catch(() => {
      document.documentElement.dataset.pwaStatus = 'failed'
    })
  })
}
