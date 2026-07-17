import type { Quote } from './calculator'
import { defaultCatalog, type PricingCatalog } from './pricing'

const catalogKey = 'shower-calc.catalog.v1'
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

const mergeCatalog = (saved: PricingCatalog): PricingCatalog => {
  const mergeItems = <T extends { id: string }>(defaults: T[], items?: T[]) => {
    if (!Array.isArray(items) || items.length === 0) return defaults
    const defaultsById = new Map(defaults.map((item) => [item.id, item]))
    return items.map((item) => ({ ...defaultsById.get(item.id), ...item } as T))
  }

  return {
    constructions: mergeItems(defaultCatalog.constructions, saved.constructions),
    glass: mergeItems(defaultCatalog.glass, saved.glass),
    hardware: mergeItems(defaultCatalog.hardware, saved.hardware),
    hardwareClass: mergeItems(defaultCatalog.hardwareClass, saved.hardwareClass),
    services: { ...defaultCatalog.services, ...saved.services },
  }
}

export const loadCatalog = () => mergeCatalog(readJson<PricingCatalog>(catalogKey, defaultCatalog))
export const saveCatalog = (catalog: PricingCatalog) => writeJson(catalogKey, catalog)
export const resetCatalog = () => {
  localStorage.removeItem(catalogKey)
  return defaultCatalog
}

export const loadQuotes = () => readJson<Quote[]>(quotesKey, [])
export const saveQuotes = (quotes: Quote[]) => writeJson(quotesKey, quotes)
