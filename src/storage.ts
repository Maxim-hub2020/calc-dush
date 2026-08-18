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
  const savedRevision = Math.max(0, Number(saved.revision) || 0)
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
      basePrice: savedRevision < 3 && currentDefault ? currentDefault.basePrice : item.basePrice,
      installationPrice: Number.isFinite(item.installationPrice) ? item.installationPrice : legacyInstallationPrice,
      hardwareComponents: savedRevision < 2 && currentDefault
        ? currentDefault.hardwareComponents
        : item.hardwareComponents,
    }
  })
  const services = { ...defaultCatalog.services, ...savedServices }
  delete services.installation

  if (savedServices.deliveryBase === 4000 && savedServices.deliveryKmRate === 70) {
    services.deliveryBase = 1500
    services.deliveryKmRate = 50
  }

  const hardwareItems = savedRevision < 2
    ? defaultCatalog.hardwareItems
    : mergeItems(defaultCatalog.hardwareItems, saved.hardwareItems)
  const hardwareItemIds = new Set(hardwareItems.map((item) => item.id))

  return {
    revision: defaultCatalog.revision,
    constructions: constructions.map((construction) => ({
      ...construction,
      hardwareComponents: (construction.hardwareComponents ?? [])
        .filter((component) => hardwareItemIds.has(component.hardwareItemId))
        .map((component) => ({
          ...component,
          quantity: Math.max(0, Number(component.quantity) || 0),
          glassThickness: component.glassThickness === 6 || component.glassThickness === 8
            ? component.glassThickness
            : undefined,
        })),
    })),
    glass: savedRevision < 2
      ? defaultCatalog.glass
      : mergeItems(defaultCatalog.glass, saved.glass),
    hardware: savedRevision < 3
      ? [
          ...defaultCatalog.hardware,
          ...(saved.hardware ?? []).filter((item) => !defaultCatalog.hardware.some((entry) => entry.id === item.id)),
        ]
      : mergeItems(defaultCatalog.hardware, saved.hardware),
    hardwareItems,
    hardwareClass: savedRevision < 4
      ? [
          ...defaultCatalog.hardwareClass,
          ...(saved.hardwareClass ?? []).filter((item) => !defaultCatalog.hardwareClass.some((entry) => entry.id === item.id)),
        ]
      : mergeItems(defaultCatalog.hardwareClass, saved.hardwareClass),
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

  const services = mergeItems(defaultMirrorCatalog.services, saved.services)
    .filter((item) => item.category !== 'delivery')
  const serviceIds = new Set(services.map((service) => service.id))
  const groups = mergeItems(defaultMirrorCatalog.groups, saved.groups).map((group) => ({
    ...group,
    visibleInQuote: group.visibleInQuote !== false,
    items: (group.items ?? [])
      .filter((item) => serviceIds.has(item.serviceId))
      .map((item) => ({ ...item, quantity: Math.max(0, Number(item.quantity) || 0) })),
  }))

  return {
    materials: mergeItems(defaultMirrorCatalog.materials, saved.materials),
    services,
    groups,
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
