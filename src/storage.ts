import type { Quote } from './calculator'
import { defaultMirrorCatalog, type MirrorPricingCatalog } from './mirrorPricing'
import { defaultCatalog, type PricingCatalog } from './pricing'

const catalogKey = 'shower-calc.catalog.v1'
const mirrorCatalogKey = 'shower-calc.mirror-catalog.v1'
const quotesKey = 'shower-calc.quotes.v1'

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const writeJson = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value))
}

export const mergeCatalog = (saved: Partial<PricingCatalog> = {}): PricingCatalog => {
  const mergeItems = <T extends { id: string }>(defaults: T[], items?: T[]) => {
    if (!Array.isArray(items) || items.length === 0) return defaults
    const defaultsById = new Map(defaults.map((item) => [item.id, item]))
    return items.map((item) => ({ ...defaultsById.get(item.id), ...item } as T))
  }

  const savedServices = (saved.services ?? {}) as Partial<PricingCatalog['services']> & { installation?: number }
  const legacyInstallationPrice = Number.isFinite(savedServices.installation)
    ? Number(savedServices.installation)
    : 5000
  const constructions = mergeItems(defaultCatalog.constructions, saved.constructions).map((item) => {
    const currentDefault = defaultCatalog.constructions.find((entry) => entry.id === item.id)
    return {
      ...item,
      imageUrl: currentDefault?.imageUrl ?? defaultCatalog.constructions[0].imageUrl,
      installationPrice: Number.isFinite(item.installationPrice) ? item.installationPrice : legacyInstallationPrice,
    }
  })
  const services = { ...defaultCatalog.services, ...savedServices }
  delete services.installation

  if (savedServices.deliveryBase === 4000 && savedServices.deliveryKmRate === 70) {
    services.deliveryBase = 1500
    services.deliveryKmRate = 50
  }

  return {
    constructions,
    glass: mergeItems(defaultCatalog.glass, saved.glass),
    hardware: mergeItems(defaultCatalog.hardware, saved.hardware),
    hardwareClass: mergeItems(defaultCatalog.hardwareClass, saved.hardwareClass),
    services,
  }
}

export const loadCatalog = () => mergeCatalog(readJson<PricingCatalog>(catalogKey, defaultCatalog))
export const saveCatalog = (catalog: PricingCatalog) => writeJson(catalogKey, catalog)
export const resetCatalog = () => {
  localStorage.removeItem(catalogKey)
  return defaultCatalog
}

export const mergeMirrorCatalog = (saved: Partial<MirrorPricingCatalog> = {}): MirrorPricingCatalog => {
  const mergeItems = <T extends { id: string }>(defaults: T[], items?: T[]) => {
    if (!Array.isArray(items) || items.length === 0) return defaults
    return items.map((item) => ({ ...defaults.find((entry) => entry.id === item.id), ...item } as T))
  }

  return {
    materials: mergeItems(defaultMirrorCatalog.materials, saved.materials),
    services: mergeItems(defaultMirrorCatalog.services, saved.services),
    settings: { ...defaultMirrorCatalog.settings, ...saved.settings },
  }
}

export const loadMirrorCatalog = () => mergeMirrorCatalog(
  readJson<MirrorPricingCatalog>(mirrorCatalogKey, defaultMirrorCatalog),
)
export const saveMirrorCatalog = (catalog: MirrorPricingCatalog) => writeJson(mirrorCatalogKey, catalog)
export const resetMirrorCatalog = () => {
  localStorage.removeItem(mirrorCatalogKey)
  return defaultMirrorCatalog
}

export const loadQuotes = () => readJson<Quote[]>(quotesKey, [])
export const saveQuotes = (quotes: Quote[]) => writeJson(quotesKey, quotes)
