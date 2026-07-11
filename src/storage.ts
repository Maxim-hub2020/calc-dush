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
  const savedConstructions = new Map(saved.constructions?.map((item) => [item.id, item]))
  const mergeOptions = <T extends { id: string; price: number }>(defaults: T[], items: T[] = []) => {
    const savedItems = new Map(items.map((item) => [item.id, item]))
    return defaults.map((item) => ({ ...item, price: savedItems.get(item.id)?.price ?? item.price }))
  }

  return {
    constructions: defaultCatalog.constructions.map((item) => ({
      ...item,
      basePrice: savedConstructions.get(item.id)?.basePrice ?? item.basePrice,
    })),
    glass: mergeOptions(defaultCatalog.glass, saved.glass),
    hardware: mergeOptions(defaultCatalog.hardware, saved.hardware),
    hardwareClass: mergeOptions(defaultCatalog.hardwareClass, saved.hardwareClass),
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
