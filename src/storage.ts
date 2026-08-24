import type { Quote } from './calculator'
import { defaultMirrorCatalog, type MirrorPricingCatalog } from './mirrorPricing'
import {
  defaultCatalog,
  resolveHardwareComponentGlassThickness,
  type PricingCatalog,
} from './pricing'
import { legacyShowerHardwareIdMap } from './showerAv24Components'

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
    const obsoleteComponentIds = savedRevision < 8
      ? new Set(['6748-corner-connector', '6750-corner-connector'])
      : new Set<string>()
    const savedComponents = (item.hardwareComponents ?? []).filter((component) => !obsoleteComponentIds.has(component.id))
    const migrationComponents = savedRevision < 8
      ? (currentDefault?.hardwareComponents ?? []).filter((component) => (
          component.id.endsWith('-wall-strike')
          && !savedComponents.some((savedComponent) => savedComponent.id === component.id)
        ))
      : []
    return {
      ...item,
      imageUrl: currentDefault?.imageUrl ?? defaultCatalog.constructions[0].imageUrl,
      basePrice: savedRevision < 3 && currentDefault ? currentDefault.basePrice : item.basePrice,
      installationPrice: Number.isFinite(item.installationPrice) ? item.installationPrice : legacyInstallationPrice,
      hardwareComponents: savedRevision < 2 && currentDefault
        ? currentDefault.hardwareComponents
        : [...savedComponents, ...migrationComponents],
    }
  })
  const services = { ...defaultCatalog.services, ...savedServices }
  delete services.installation

  if (savedServices.deliveryBase === 4000 && savedServices.deliveryKmRate === 70) {
    services.deliveryBase = 1500
    services.deliveryKmRate = 50
  }

  const normalizedSavedHardwareItems = (saved.hardwareItems ?? []).map((item) => ({
    ...item,
    id: legacyShowerHardwareIdMap[item.id] ?? item.id,
  }))
  const defaultHardwareItemIds = new Set(defaultCatalog.hardwareItems.map((item) => item.id))
  const savedHardwareItemsById = new Map(normalizedSavedHardwareItems.map((item) => [item.id, item]))
  const hardwareItems = (savedRevision < 8
    ? [
        ...defaultCatalog.hardwareItems.map((item) => {
          const savedItem = savedHardwareItemsById.get(item.id)
          return { ...item, ...savedItem, sectionId: savedItem?.sectionId ?? item.sectionId }
        }),
        ...normalizedSavedHardwareItems
          .filter((item) => !defaultHardwareItemIds.has(item.id))
          .map((item) => ({ ...item, sectionId: item.sectionId ?? 'accessories' })),
      ]
    : mergeItems(defaultCatalog.hardwareItems, normalizedSavedHardwareItems))
    .map((item) => ({ ...item, sectionId: item.sectionId ?? 'accessories' }))
  const hardwareItemIds = new Set(hardwareItems.map((item) => item.id))
  const hardwareItemsById = new Map(hardwareItems.map((item) => [item.id, item]))

  return {
    revision: defaultCatalog.revision,
    constructions: constructions.map((construction) => ({
      ...construction,
      hardwareComponents: (construction.hardwareComponents ?? [])
        .map((component) => ({
          ...component,
          hardwareItemId: legacyShowerHardwareIdMap[component.hardwareItemId] ?? component.hardwareItemId,
        }))
        .filter((component) => hardwareItemIds.has(component.hardwareItemId))
        .map((component) => {
          const hardwareItem = hardwareItemsById.get(component.hardwareItemId)
          return {
            ...component,
            quantity: Math.max(0, Number(component.quantity) || 0),
            glassThickness: hardwareItem
              ? resolveHardwareComponentGlassThickness(component, hardwareItem)
              : undefined,
          }
        }),
    })),
    glass: savedRevision < 2
      ? defaultCatalog.glass
      : mergeItems(defaultCatalog.glass, saved.glass),
    hardware: savedRevision < 3
      ? [
          ...defaultCatalog.hardware,
          ...(saved.hardware ?? []).filter((item) => !defaultCatalog.hardware.some((entry) => entry.id === item.id)),
        ]
      : savedRevision < 9
        ? [
            ...defaultCatalog.hardware.map((item) => ({
              ...item,
              ...(saved.hardware ?? []).find((savedItem) => savedItem.id === item.id),
            })),
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
  const savedRevision = Math.max(0, Number(saved.revision) || 0)
  const mergeItems = <T extends { id: string }>(defaults: T[], items?: T[]) => {
    if (!Array.isArray(items) || items.length === 0) return defaults
    return items.map((item) => ({ ...defaults.find((entry) => entry.id === item.id), ...item } as T))
  }

  const savedMaterials = Array.isArray(saved.materials) ? saved.materials : []
  const legacyMaterialIds = new Set([
    'glass-4',
    'glass-5',
    'glass-6',
    'glass-8',
    'glass-10',
    'clearvision-4',
    'clearvision-6',
    'clearvision-8',
    'clearvision-10',
    'matelux-white-4',
    'matelux-bronze-4',
    'matelux-white-6',
    'matelux-white-8',
    'lacobel-basic-4',
    'lacobel-clear-white-4',
    'mirror-graphite-4',
    'mirror-silver-4',
    'mirror-clear-4',
    'glass-graphite-4',
    'glass-tempered-8',
  ])
  const defaultMaterialIds = new Set(defaultMirrorCatalog.materials.map((item) => item.id))
  const isReplacedMaterial = (item: { id: string; label: string }) => {
    const label = item.label.toLocaleLowerCase('ru').replaceAll('ё', 'е')
    return legacyMaterialIds.has(item.id) || (label.includes('зеркало') && label.includes('состар'))
  }
  const materials = savedRevision < 3
    ? [
        ...defaultMirrorCatalog.materials,
        ...savedMaterials.filter((item) => !isReplacedMaterial(item) && !defaultMaterialIds.has(item.id)),
      ]
    : mergeItems(defaultMirrorCatalog.materials, saved.materials)

  const legacyServiceIdMap = new Map([
    ['euro-edge-4', 'yugros-edge-straight-4'],
    ['euro-edge-shaped-4', 'yugros-edge-cnc-4'],
    ['bevel-10', 'yugros-bevel-5-10'],
  ])
  const savedServices = Array.isArray(saved.services) ? saved.services : []
  const savedServicesById = new Map(savedServices.map((item) => [item.id, item]))
  const defaultServiceIds = new Set(defaultMirrorCatalog.services.map((item) => item.id))
  const services = (savedRevision < 3
    ? [
        ...defaultMirrorCatalog.services.map((item) => (
          item.id.startsWith('yugros-') ? item : { ...item, ...savedServicesById.get(item.id) }
        )),
        ...savedServices.filter((item) => !defaultServiceIds.has(item.id) && !legacyServiceIdMap.has(item.id)),
      ]
    : mergeItems(defaultMirrorCatalog.services, saved.services))
    .filter((item) => item.category !== 'delivery')
    .map((item) => ({ ...item, sectionId: item.sectionId ?? 'works' }))
  const serviceIds = new Set(services.map((service) => service.id))
  const groups = mergeItems(defaultMirrorCatalog.groups, saved.groups).map((group) => ({
    ...group,
    visibleInQuote: group.visibleInQuote !== false,
    items: (group.items ?? [])
      .map((item) => ({ ...item, serviceId: legacyServiceIdMap.get(item.serviceId) ?? item.serviceId }))
      .filter((item) => serviceIds.has(item.serviceId))
      .map((item) => ({ ...item, quantity: Math.max(0, Number(item.quantity) || 0) })),
  }))

  return {
    revision: defaultMirrorCatalog.revision,
    materials,
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
