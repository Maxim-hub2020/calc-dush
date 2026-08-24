import {
  defaultCatalog,
  resolveHardwareComponentGlassThickness,
  type Construction,
  type PriceOption,
  type PricingCatalog,
} from './pricing'
import {
  getMirrorCalculatedOptions,
  getMirrorMaterial,
  getMirrorServiceGroup,
  getMirrorTitle,
  type MirrorForm,
} from './mirrorCalculator'
import type { MirrorPricingCatalog, MirrorUnit } from './mirrorPricing'
import { roundMoneyUp } from './money'

export { roundMoneyUp } from './money'

export type DeliveryZone = 'inside' | 'outside'

export type QuoteDelivery = {
  enabled: boolean
  zone: DeliveryZone
  km: number
}

export type QuoteCustomer = {
  clientName: string
  clientPhone: string
  note: string
}

export type ShowerProductionDesign = {
  opening?: {
    heightMm?: number
    curbWidthMm?: number
    segments?: Record<string, number>
  }
  doors?: Record<string, {
    hingeEdge?: 'left' | 'right'
    swingDirection?: 'inward' | 'outward'
    hingeJointType?: 'none' | 'wall' | 'glass-180' | 'glass-90' | 'glass-135' | 'invalid'
    hingeHardwareItemId?: string
    hingeQuantity?: number
  }>
  connectors?: Record<string, {
    verticalCount?: number
    horizontalCount?: number
    verticalEdge?: 'left' | 'right'
    horizontalEdge?: 'top' | 'bottom'
    mountType?: 'connectors' | 'profile'
    profileHardwareItemId?: string
  }>
  magnetic?: Record<string, {
    edge?: 'left' | 'right'
    gapMm?: number
    strikeWidthMm?: number
  }>
}

export type QuoteVariant = {
  id: string
  title: string
  itemIds: string[]
  orderDelivery: QuoteDelivery
  deliveryPrice: number
  manualTotal?: number
}

export type CalculatorForm = {
  constructionId: string
  dimensions: Record<string, number>
  glassId: string
  hardwareId: string
  hardwareClassId: string
  installation: boolean
  delivery: boolean
  deliveryZone: DeliveryZone
  deliveryKm: number
  discountEnabled: boolean
  discountPercent: number
  designerEnabled: boolean
  clientName: string
  clientPhone: string
  note: string
  productionDesign?: ShowerProductionDesign
  productionPriceAdjustment?: number
}

export type CalculationLine = {
  label: string
  value: number
}

export type CalculationResult = {
  product: number
  installation: number
  delivery: number
  manager: number
  designer: number
  subtotal: number
  discount: number
  total: number
  glassArea: number
  hardwarePrice: number
  hasSurcharge: boolean
  errors: Record<string, string>
  lines: CalculationLine[]
}

export type QuoteDetailLine = {
  id: string
  label: string
  value: string
}

export type ShowerQuoteItem = {
  id: string
  kind?: 'shower'
  quantity?: number
  form: CalculatorForm
  result: CalculationResult
  constructionTitle: string
  glassLabel: string
  hardwareLabel: string
  hardwareClassLabel: string
  details?: QuoteDetailLine[]
}

export type MirrorQuoteServiceLine = {
  label: string
  quantity: number
  unit: MirrorUnit
  unitLabel: string
  visibleInQuote: boolean
}

export type MirrorQuoteItem = {
  id: string
  kind: 'mirror'
  quantity?: number
  form: MirrorForm
  result: CalculationResult
  mirrorTitle: string
  materialLabel: string
  serviceLines: MirrorQuoteServiceLine[]
  details?: QuoteDetailLine[]
}

export type QuoteItem = ShowerQuoteItem | MirrorQuoteItem

type QuoteMetadata = {
  id: string
  number: string
  createdAt: string
  updatedAt: string
  status: 'new' | 'sent' | 'accepted' | 'archived'
  items?: QuoteItem[]
  variants?: QuoteVariant[]
  orderDelivery?: QuoteDelivery
  customer?: QuoteCustomer
  manualTotal?: number
}

export type Quote = QuoteItem & QuoteMetadata

export type ShowerQuoteDraftItem = {
  kind: 'shower'
  quantity?: number
  form: CalculatorForm
  result: CalculationResult
}

export type MirrorQuoteDraftItem = {
  kind: 'mirror'
  quantity?: number
  form: MirrorForm
  result: CalculationResult
}

export type QuoteDraftItem = ShowerQuoteDraftItem | MirrorQuoteDraftItem

export type ManualQuoteItemPatch = {
  id: string
  title: string
  quantity: number
  product: number
  details: QuoteDetailLine[]
}

export type ManualQuoteVariantPatch = {
  id: string
  title: string
  itemIds: string[]
  orderDelivery: QuoteDelivery
  deliveryPrice: number
  manualTotalEnabled: boolean
  manualTotal: number
}

export type ManualQuotePatch = {
  clientName: string
  clientPhone: string
  note: string
  discountEnabled: boolean
  discountPercent: number
  manualTotalEnabled: boolean
  manualTotal: number
  orderDelivery: QuoteDelivery
  deliveryPrice: number
  items: ManualQuoteItemPatch[]
  splitIntoVariants: boolean
  variants: ManualQuoteVariantPatch[]
}

const roundToTen = (value: number) => Math.round(value / 10) * 10
const ceilToTen = (value: number) => Math.ceil(value / 10) * 10

export const money = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)

export const shortMoney = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)

export const getPublicProductPrice = (result: CalculationResult) => result.product + result.installation

export const normalizeQuoteQuantity = (value: unknown) => {
  const quantity = Math.floor(Number(value) || 1)
  return Math.min(999, Math.max(1, quantity))
}

export const getQuoteItemQuantity = (item: Pick<QuoteItem, 'quantity'>) => normalizeQuoteQuantity(item.quantity)

export const normalizeQuoteDelivery = (delivery?: Partial<QuoteDelivery> | null): QuoteDelivery => ({
  enabled: Boolean(delivery?.enabled),
  zone: delivery?.zone === 'outside' ? 'outside' : 'inside',
  km: Math.max(0, Number(delivery?.km) || 0),
})

export const normalizeQuoteCustomer = (customer?: Partial<QuoteCustomer> | null): QuoteCustomer => ({
  clientName: String(customer?.clientName ?? ''),
  clientPhone: String(customer?.clientPhone ?? ''),
  note: String(customer?.note ?? ''),
})

export const calculateQuoteDelivery = (catalog: PricingCatalog, delivery: QuoteDelivery) => {
  const normalized = normalizeQuoteDelivery(delivery)
  if (!normalized.enabled) return 0
  if (normalized.zone === 'outside') {
    const basePrice = Math.max(0, Number(catalog.services.deliveryBase) || 0)
    const distancePrice = normalized.km * Math.max(0, Number(catalog.services.deliveryKmRate) || 0)
    return roundMoneyUp(basePrice + distancePrice)
  }
  return roundMoneyUp(Math.max(0, Number(catalog.services.deliveryBase) || 0))
}

export const buildCalculationLines = (
  product: number,
  installation: number,
  delivery: number,
  discount: number,
): CalculationLine[] => {
  const lines: CalculationLine[] = [
    { label: 'Стоимость изделия', value: product + installation },
    { label: 'Доставка', value: delivery },
  ]
  if (discount > 0) lines.push({ label: 'Скидка', value: discount })
  return lines
}

export const findById = <T extends { id: string }>(items: T[], id: string, fallback: T) =>
  items.find((item) => item.id === id) ?? fallback

export const getConstruction = (catalog: PricingCatalog, id: string) =>
  findById(catalog.constructions, id, catalog.constructions[0])

export const getOption = (items: PriceOption[], id: string) => findById(items, id, items[0])

export const getConstructionHardwareComponents = (
  catalog: PricingCatalog,
  construction: Construction,
  glassThickness?: 6 | 8,
) => (
  (construction.hardwareComponents ?? [])
    .flatMap((component) => {
      const item = catalog.hardwareItems.find((hardwareItem) => hardwareItem.id === component.hardwareItemId)
      if (!item) return []
      const compatibleThickness = resolveHardwareComponentGlassThickness(component, item)
      if (glassThickness && compatibleThickness && compatibleThickness !== glassThickness) return []
      const quantity = Math.max(0, Number(component.quantity) || 0)
      return [{
        ...component,
        glassThickness: compatibleThickness,
        item,
        quantity,
        total: item.price * quantity,
      }]
    })
)

export const getConstructionHardwareBasePrice = (
  catalog: PricingCatalog,
  construction: Construction,
  glassThickness?: 6 | 8,
) => {
  const components = getConstructionHardwareComponents(catalog, construction, glassThickness)
  return components.length > 0
    ? components.reduce((sum, component) => sum + component.total, 0)
    : 0
}

export const createInitialForm = (catalog: PricingCatalog): CalculatorForm => {
  const construction = catalog.constructions[0]
  return {
    constructionId: construction.id,
    dimensions: construction.fields.reduce<Record<string, number>>((acc, field) => {
      acc[field.key] = field.defaultValue
      return acc
    }, {}),
    glassId: catalog.glass[0].id,
    hardwareId: catalog.hardware[0].id,
    hardwareClassId: catalog.hardwareClass[0].id,
    installation: false,
    delivery: false,
    deliveryZone: 'inside',
    deliveryKm: 0,
    discountEnabled: false,
    discountPercent: catalog.services.discountPercent,
    designerEnabled: false,
    clientName: '',
    clientPhone: '',
    note: '',
  }
}

export const resetDimensionsForConstruction = (construction: Construction) =>
  construction.fields.reduce<Record<string, number>>((acc, field) => {
    acc[field.key] = field.defaultValue
    return acc
  }, {})

const validateDimensions = (construction: Construction, dimensions: Record<string, number>) =>
  construction.fields.reduce<Record<string, string>>((errors, field) => {
    const value = Number(dimensions[field.key] ?? 0)
    if (!Number.isFinite(value) || value <= 0) {
      errors[field.key] = 'Заполните значение'
    }
    return errors
  }, {})

export const calculateQuote = (catalog: PricingCatalog, form: CalculatorForm): CalculationResult => {
  const construction = getConstruction(catalog, form.constructionId)
  const glass = getOption(catalog.glass, form.glassId)
  const hardware = getOption(catalog.hardware, form.hardwareId)
  const hardwareClass = getOption(catalog.hardwareClass, form.hardwareClassId)
  const errors = validateDimensions(construction, form.dimensions)
  const heightField = construction.fields.find((field) => field.key.startsWith('HEIGHT'))
  const height = Number(form.dimensions[heightField?.key ?? 'HEIGHT_0'] ?? 0)
  const widths = construction.fields
    .filter((field) => field.key.startsWith('WIDTH'))
    .map((field) => Number(form.dimensions[field.key] ?? 0))
  const glassArea = widths.reduce((sum, width) => sum + width * 0.001 * height * 0.001, 0)
  const glassPrice = widths.reduce((sum, width) => sum + Math.round(width * 0.001 * height * 0.001 * glass.price), 0)
  const hardwareBasePrice = Math.max(0, getConstructionHardwareBasePrice(
    catalog,
    construction,
    glass.thickness,
  ) + (Number(form.productionPriceAdjustment) || 0))
  const hasHardwareComposition = getConstructionHardwareComponents(catalog, construction, glass.thickness).length > 0
  const fallbackConstructionBase = hasHardwareComposition ? 0 : Math.max(0, Number(construction.basePrice) || 0)
  const hardwareClassFactor = 1 + Math.max(0, Number(hardwareClass.price) || 0) / 100
  const hardwareColorFactor = 1 + Math.max(0, Number(hardware.price) || 0) / 100
  const hardwarePrice = hardwareBasePrice * hardwareClassFactor * hardwareColorFactor
  const hasSurcharge = height > catalog.services.heightSurchargeAfter
  const surchargeFactor = hasSurcharge ? 1 + catalog.services.heightSurchargePercent / 100 : 1
  const applySurcharge = (value: number) => roundToTen(value * surchargeFactor)
  const productMarkupFactor = 1 + Math.max(0, Number(catalog.services.productMarkupPercent) || 0) / 100
  const hardwareMarkupFactor = 1 + Math.max(0, Number(catalog.services.hardwareMarkupPercent) || 0) / 100

  const baseProduct = Object.keys(errors).length > 0
    ? 0
    : ceilToTen((glassPrice + fallbackConstructionBase) * productMarkupFactor + hardwarePrice * hardwareMarkupFactor)
  const baseProductWithSurcharge = applySurcharge(baseProduct)
  const baseInstallation = form.installation ? construction.installationPrice : 0
  const designerPercent = Math.max(0, Number(catalog.services.designerPercent) || 0)
  const designerFactor = form.designerEnabled ? 1 + designerPercent / 100 : 1
  const productBeforeRounding = roundToTen(baseProductWithSurcharge * designerFactor)
  const installation = roundToTen(baseInstallation * designerFactor)
  const subtotal = roundMoneyUp(productBeforeRounding + installation)
  const product = subtotal - installation
  const delivery = 0
  const designer = subtotal - baseProductWithSurcharge - baseInstallation
  const discountPercent = Math.min(100, Math.max(0, Number(form.discountPercent) || 0))
  const total = form.discountEnabled
    ? roundMoneyUp(subtotal - (subtotal / 100) * discountPercent)
    : subtotal
  const discount = subtotal - total
  const lines = buildCalculationLines(product, installation, delivery, discount)

  return {
    product,
    installation,
    delivery,
    manager: 0,
    designer,
    subtotal,
    discount,
    total,
    glassArea,
    hardwarePrice,
    hasSurcharge,
    errors,
    lines,
  }
}

export const combineCalculationResults = (results: CalculationResult[]): CalculationResult => {
  const sum = (pick: (result: CalculationResult) => number) => results.reduce((total, result) => total + pick(result), 0)
  const product = sum((result) => result.product)
  const installation = sum((result) => result.installation)
  const delivery = sum((result) => result.delivery)
  const subtotal = sum((result) => result.subtotal)
  const discount = sum((result) => result.discount)
  const lines = buildCalculationLines(product, installation, delivery, discount)

  return {
    product,
    installation,
    delivery,
    manager: sum((result) => result.manager ?? 0),
    designer: sum((result) => result.designer),
    subtotal,
    discount,
    total: sum((result) => result.total),
    glassArea: sum((result) => result.glassArea),
    hardwarePrice: sum((result) => result.hardwarePrice),
    hasSurcharge: results.some((result) => result.hasSurcharge),
    errors: {},
    lines,
  }
}

export const applyQuoteDelivery = (
  result: CalculationResult,
  deliveryPriceValue: unknown,
): CalculationResult => {
  const delivery = roundMoneyUp(deliveryPriceValue)
  return {
    ...result,
    delivery,
    subtotal: result.subtotal + delivery,
    total: result.total + delivery,
    lines: buildCalculationLines(result.product, result.installation, delivery, result.discount),
  }
}

export const multiplyCalculationResult = (
  result: CalculationResult,
  quantityValue: unknown,
): CalculationResult => {
  const quantity = normalizeQuoteQuantity(quantityValue)
  return {
    ...result,
    product: result.product * quantity,
    installation: result.installation * quantity,
    delivery: result.delivery * quantity,
    manager: (result.manager ?? 0) * quantity,
    designer: result.designer * quantity,
    subtotal: result.subtotal * quantity,
    discount: result.discount * quantity,
    total: result.total * quantity,
    glassArea: result.glassArea * quantity,
    hardwarePrice: result.hardwarePrice * quantity,
    errors: { ...result.errors },
    lines: result.lines.map((line) => ({ ...line, value: line.value * quantity })),
  }
}

const hingeQuoteLabels: Record<NonNullable<NonNullable<ShowerProductionDesign['doors']>[string]['hingeJointType']>, string> = {
  none: 'Петли',
  wall: 'Петли стена-стекло',
  'glass-180': 'Петли стекло-стекло 180°',
  'glass-90': 'Петли стекло-стекло 90°',
  'glass-135': 'Петли стекло-стекло 135°',
  invalid: 'Петли требуют проверки',
}

const buildShowerQuoteDetails = (
  catalog: PricingCatalog,
  itemId: string,
  form: CalculatorForm,
  glassLabel: string,
  hardwareLabel: string,
  hardwareClassLabel: string,
): QuoteDetailLine[] => {
  const construction = getConstruction(catalog, form.constructionId)
  const hingeGroups = new Map<string, {
    jointType: NonNullable<NonNullable<ShowerProductionDesign['doors']>[string]['hingeJointType']>
    hardwareItemId?: string
    quantity: number
  }>()
  Object.values(form.productionDesign?.doors ?? {}).forEach((door) => {
    if (!door.hingeJointType || door.hingeJointType === 'none' || door.hingeQuantity === 0) return
    const key = `${door.hingeJointType}:${door.hingeHardwareItemId ?? ''}`
    const current = hingeGroups.get(key)
    hingeGroups.set(key, {
      jointType: door.hingeJointType,
      hardwareItemId: door.hingeHardwareItemId,
      quantity: (current?.quantity ?? 0) + Math.max(1, Math.round(Number(door.hingeQuantity) || 0)),
    })
  })
  return [
    ...construction.fields.map((field) => ({
      id: `${itemId}:dimension:${field.key}`,
      label: field.label,
      value: `${form.dimensions[field.key] ?? 0} мм`,
    })),
    { id: `${itemId}:glass`, label: 'Стекло', value: glassLabel },
    { id: `${itemId}:hardware`, label: 'Фурнитура', value: hardwareLabel },
    { id: `${itemId}:hardware-class`, label: 'Класс фурнитуры', value: hardwareClassLabel },
    ...[...hingeGroups.values()].map((hinge, index) => {
      const item = catalog.hardwareItems.find((entry) => entry.id === hinge.hardwareItemId)
      return {
        id: `${itemId}:hinge:${index}`,
        label: hingeQuoteLabels[hinge.jointType],
        value: `${item?.sku ?? item?.label ?? 'артикул не выбран'} · ${hinge.quantity} шт.`,
      }
    }),
  ]
}

const createShowerQuoteItem = (catalog: PricingCatalog, draft: ShowerQuoteDraftItem): ShowerQuoteItem => {
  const construction = getConstruction(catalog, draft.form.constructionId)
  const glass = getOption(catalog.glass, draft.form.glassId)
  const hardware = getOption(catalog.hardware, draft.form.hardwareId)
  const hardwareClass = getOption(catalog.hardwareClass, draft.form.hardwareClassId)
  const id = crypto.randomUUID()
  return {
    id,
    kind: 'shower',
    quantity: normalizeQuoteQuantity(draft.quantity),
    form: draft.form,
    result: draft.result,
    constructionTitle: construction.title,
    glassLabel: glass.label,
    hardwareLabel: hardware.label,
    hardwareClassLabel: hardwareClass.label,
    details: buildShowerQuoteDetails(catalog, id, draft.form, glass.label, hardware.label, hardwareClass.label),
  }
}

const createMirrorQuoteItem = (
  catalog: MirrorPricingCatalog,
  draft: MirrorQuoteDraftItem,
): MirrorQuoteItem => {
  const directServiceLines = getMirrorCalculatedOptions(catalog, draft.form)
    .filter((item) => item.category !== 'delivery' && !item.groupId)
    .map((item) => ({
      label: item.label,
      quantity: item.quantity,
      unit: item.unit,
      unitLabel: item.unitLabel,
      visibleInQuote: item.visibleInQuote,
    }))
  const groupServiceLines = (draft.form.groups ?? []).flatMap((selection) => {
    const group = getMirrorServiceGroup(catalog, selection.groupId)
    return group ? [{
      label: group.label,
      quantity: 1,
      unit: 'piece' as const,
      unitLabel: 'шт.',
      visibleInQuote: group.visibleInQuote,
    }] : []
  })

  return {
    id: crypto.randomUUID(),
    kind: 'mirror',
    quantity: normalizeQuoteQuantity(draft.quantity),
    form: draft.form,
    result: draft.result,
    mirrorTitle: getMirrorTitle(draft.form),
    materialLabel: getMirrorMaterial(catalog, draft.form.materialId).label,
    serviceLines: [...directServiceLines, ...groupServiceLines],
  }
}

export const isMirrorQuoteItem = (item: QuoteItem): item is MirrorQuoteItem => item.kind === 'mirror'
export const isShowerQuoteItem = (item: QuoteItem): item is ShowerQuoteItem => item.kind !== 'mirror'

export const getQuoteItemTitle = (item: QuoteItem) =>
  isMirrorQuoteItem(item) ? item.mirrorTitle : item.constructionTitle

export const getQuoteItemDetails = (item: QuoteItem): QuoteDetailLine[] => {
  if (Array.isArray(item.details)) return item.details
  if (isMirrorQuoteItem(item)) {
    return [
      { id: `${item.id}:size`, label: 'Размер', value: `${item.form.width} × ${item.form.height} мм` },
      { id: `${item.id}:material`, label: 'Материал', value: item.materialLabel },
      ...item.serviceLines
        .filter((line) => line.visibleInQuote && !line.label.trim().toLowerCase().startsWith('доставка'))
        .map((line, index) => ({
          id: `${item.id}:service:${index}`,
          label: line.label,
          value: `${line.quantity.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${line.unitLabel}`,
        })),
    ]
  }

  return buildShowerQuoteDetails(
    defaultCatalog,
    item.id,
    item.form,
    item.glassLabel,
    item.hardwareLabel,
    item.hardwareClassLabel,
  )
}

export const getQuoteTotal = (quote: Quote) => {
  const variants = getQuoteVariants(quote)
  if (variants.length > 0) {
    return Math.min(...variants.map((variant) => getQuoteVariantTotals(quote, variant).total))
  }
  return Number.isFinite(quote.manualTotal)
    ? Math.max(0, Number(quote.manualTotal))
    : quote.result.total
}

export const getQuoteItems = (quote: Quote): QuoteItem[] => {
  if (quote.items?.length) {
    return quote.items.map((item) => ({ ...item, quantity: getQuoteItemQuantity(item) }))
  }
  if (quote.kind === 'mirror') {
    return [{
      id: quote.id,
      kind: 'mirror',
      quantity: normalizeQuoteQuantity(quote.quantity),
      form: quote.form,
      result: quote.result,
      mirrorTitle: quote.mirrorTitle,
      materialLabel: quote.materialLabel,
      serviceLines: quote.serviceLines ?? [],
    }]
  }
  return [{
    id: quote.id,
    kind: 'shower',
    quantity: normalizeQuoteQuantity(quote.quantity),
    form: quote.form,
    result: quote.result,
    constructionTitle: quote.constructionTitle,
    glassLabel: quote.glassLabel,
    hardwareLabel: quote.hardwareLabel,
    hardwareClassLabel: quote.hardwareClassLabel,
  }]
}

export const getQuoteVariants = (quote: Quote): QuoteVariant[] => {
  if (!Array.isArray(quote.variants) || quote.variants.length < 2) return []
  const itemIds = new Set(getQuoteItems(quote).map((item) => item.id))
  return quote.variants.map((variant, index) => ({
    id: variant.id || `variant-${index + 1}`,
    title: String(variant.title || `Вариант ${index + 1}`),
    itemIds: Array.from(new Set(
      Array.isArray(variant.itemIds) ? variant.itemIds.filter((itemId) => itemIds.has(itemId)) : [],
    )),
    orderDelivery: normalizeQuoteDelivery(variant.orderDelivery),
    deliveryPrice: roundMoneyUp(variant.deliveryPrice),
    manualTotal: Number.isFinite(variant.manualTotal)
      ? roundMoneyUp(variant.manualTotal)
      : undefined,
  }))
}

export type QuoteVariantTotals = {
  product: number
  delivery: number
  subtotal: number
  discount: number
  total: number
}

export const getQuoteVariantTotals = (quote: Quote, variant: QuoteVariant): QuoteVariantTotals => {
  const variantItemIds = new Set(variant.itemIds)
  const items = getQuoteItems(quote).filter((item) => variantItemIds.has(item.id))
  const itemResult = combineCalculationResults(items.map((item) => (
    multiplyCalculationResult(item.result, getQuoteItemQuantity(item))
  )))
  const delivery = variant.orderDelivery.enabled ? roundMoneyUp(variant.deliveryPrice) : 0
  const calculatedTotal = itemResult.total + delivery

  return {
    product: itemResult.product + itemResult.installation,
    delivery,
    subtotal: itemResult.subtotal + delivery,
    discount: itemResult.discount,
    total: Number.isFinite(variant.manualTotal)
      ? roundMoneyUp(variant.manualTotal)
      : calculatedTotal,
  }
}

export const getQuoteDelivery = (quote: Quote): QuoteDelivery => {
  if (getQuoteVariants(quote).length > 0) return normalizeQuoteDelivery(null)
  if (quote.orderDelivery) return normalizeQuoteDelivery(quote.orderDelivery)
  const legacyShower = getQuoteItems(quote).find(isShowerQuoteItem)
  if (legacyShower?.form.delivery) {
    return normalizeQuoteDelivery({
      enabled: true,
      zone: legacyShower.form.deliveryZone,
      km: legacyShower.form.deliveryKm,
    })
  }
  return normalizeQuoteDelivery({ enabled: quote.result.delivery > 0 })
}

export const getQuoteCustomer = (quote: Quote): QuoteCustomer => (
  normalizeQuoteCustomer(quote.customer ?? quote.form)
)

export const getNextQuoteNumber = (quotes: Array<Pick<Quote, 'number'>>) => {
  const usedNumbers = quotes
    .map((quote) => quote.number.trim())
    .filter((number) => /^\d{4}$/.test(number))
    .map(Number)
  const nextNumber = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1001

  if (nextNumber > 9999) {
    throw new Error('Закончились доступные четырехзначные номера КП')
  }

  return String(nextNumber)
}

export const createQuote = (
  catalog: PricingCatalog,
  mirrorCatalog: MirrorPricingCatalog,
  drafts: QuoteDraftItem[],
  orderDelivery: QuoteDelivery,
  customer: QuoteCustomer,
  number: string,
): Quote => {
  if (drafts.length === 0) throw new Error('КП должно содержать хотя бы одну позицию')
  const normalizedCustomer = normalizeQuoteCustomer(customer)
  const items = drafts.map((draft) => draft.kind === 'mirror'
    ? createMirrorQuoteItem(mirrorCatalog, draft)
    : createShowerQuoteItem(catalog, draft))
  const firstItem = items[0]
  const createdAt = new Date().toISOString()
  const id = crypto.randomUUID()
  const normalizedDelivery = normalizeQuoteDelivery(orderDelivery)
  const itemResult = combineCalculationResults(items.map((item) => (
    multiplyCalculationResult(item.result, getQuoteItemQuantity(item))
  )))

  return {
    ...firstItem,
    id,
    number,
    createdAt,
    updatedAt: createdAt,
    status: 'new',
    result: applyQuoteDelivery(itemResult, calculateQuoteDelivery(catalog, normalizedDelivery)),
    items,
    orderDelivery: normalizedDelivery,
    customer: normalizedCustomer,
  }
}

export const updateQuoteManually = (quote: Quote, patch: ManualQuotePatch): Quote => {
  const itemsById = new Map(getQuoteItems(quote).map((item) => [item.id, item]))
  const discountPercent = Math.min(100, Math.max(0, Number(patch.discountPercent) || 0))
  const customer = normalizeQuoteCustomer(patch)
  const updatedItems = patch.items.flatMap((itemPatch): QuoteItem[] => {
    const item = itemsById.get(itemPatch.id)
    if (!item) return []
    const product = roundMoneyUp(itemPatch.product)
    const quantity = normalizeQuoteQuantity(itemPatch.quantity)
    const subtotal = product
    const total = patch.discountEnabled
      ? roundMoneyUp(subtotal * (1 - discountPercent / 100))
      : subtotal
    const discount = subtotal - total
    const sharedForm = {
      clientName: '',
      clientPhone: '',
      note: '',
      discountEnabled: patch.discountEnabled,
      discountPercent,
    }
    const result: CalculationResult = {
      ...item.result,
      product,
      installation: 0,
      delivery: 0,
      manager: 0,
      designer: 0,
      subtotal,
      discount,
      total,
      lines: buildCalculationLines(product, 0, 0, discount),
    }

    if (isMirrorQuoteItem(item)) {
      const form: MirrorForm = { ...item.form, ...sharedForm }
      return [{ ...item, quantity, form, result, mirrorTitle: itemPatch.title, details: itemPatch.details }]
    }
    const form: CalculatorForm = {
      ...item.form,
      ...sharedForm,
      delivery: false,
      deliveryZone: 'inside',
      deliveryKm: 0,
    }
    return [{ ...item, quantity, form, result, constructionTitle: itemPatch.title, details: itemPatch.details }]
  })
  if (updatedItems.length === 0) return quote
  const firstItem = updatedItems[0]
  const itemResult = combineCalculationResults(updatedItems.map((item) => (
    multiplyCalculationResult(item.result, getQuoteItemQuantity(item))
  )))
  const updatedItemIds = new Set(updatedItems.map((item) => item.id))
  const assignedItemIds = new Set<string>()
  const variantDrafts = patch.splitIntoVariants
    ? patch.variants.map((variant, index): QuoteVariant => {
        const itemIds = variant.itemIds.filter((itemId) => {
          if (!updatedItemIds.has(itemId) || assignedItemIds.has(itemId)) return false
          assignedItemIds.add(itemId)
          return true
        })
        return {
          id: variant.id || crypto.randomUUID(),
          title: variant.title.trim() || `Вариант ${index + 1}`,
          itemIds,
          orderDelivery: normalizeQuoteDelivery(variant.orderDelivery),
          deliveryPrice: variant.orderDelivery.enabled ? roundMoneyUp(variant.deliveryPrice) : 0,
          manualTotal: variant.manualTotalEnabled ? roundMoneyUp(variant.manualTotal) : undefined,
        }
      })
    : []
  const variants = variantDrafts.length >= 2 ? variantDrafts : undefined
  if (variants) {
    const unassignedItemIds = updatedItems
      .map((item) => item.id)
      .filter((itemId) => !assignedItemIds.has(itemId))
    variants[0].itemIds.push(...unassignedItemIds)
  }
  const orderDelivery = variants
    ? normalizeQuoteDelivery(null)
    : normalizeQuoteDelivery(patch.orderDelivery)
  const result = applyQuoteDelivery(
    itemResult,
    variants ? 0 : orderDelivery.enabled ? patch.deliveryPrice : 0,
  )
  const manualTotal = !variants && patch.manualTotalEnabled
    ? roundMoneyUp(patch.manualTotal)
    : undefined

  return {
    ...firstItem,
    id: quote.id,
    number: quote.number,
    createdAt: quote.createdAt,
    updatedAt: new Date().toISOString(),
    status: quote.status,
    result,
    items: updatedItems,
    variants,
    orderDelivery,
    customer,
    manualTotal,
  }
}
