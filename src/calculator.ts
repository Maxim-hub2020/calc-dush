import { defaultCatalog, type Construction, type PriceOption, type PricingCatalog } from './pricing'
import {
  getMirrorCalculatedOptions,
  getMirrorMaterial,
  getMirrorTitle,
  type MirrorForm,
} from './mirrorCalculator'
import type { MirrorPricingCatalog, MirrorUnit } from './mirrorPricing'

export type DeliveryZone = 'inside' | 'outside'

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
  status: 'new' | 'sent' | 'accepted' | 'archived'
  items?: QuoteItem[]
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
  delivery: number
  details: QuoteDetailLine[]
}

export type ManualQuotePatch = {
  clientName: string
  clientPhone: string
  note: string
  discountEnabled: boolean
  discountPercent: number
  manualTotalEnabled: boolean
  manualTotal: number
  items: ManualQuoteItemPatch[]
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

export const buildCalculationLines = (
  product: number,
  installation: number,
  delivery: number,
  discount: number,
  discountPercent: number,
): CalculationLine[] => {
  const lines: CalculationLine[] = [
    { label: 'Стоимость изделия', value: product + installation },
    { label: 'Доставка', value: delivery },
  ]
  if (discount > 0) lines.push({ label: `Скидка ${discountPercent}%`, value: discount })
  return lines
}

export const findById = <T extends { id: string }>(items: T[], id: string, fallback: T) =>
  items.find((item) => item.id === id) ?? fallback

export const getConstruction = (catalog: PricingCatalog, id: string) =>
  findById(catalog.constructions, id, catalog.constructions[0])

export const getOption = (items: PriceOption[], id: string) => findById(items, id, items[0])

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
    } else if (value < field.min) {
      errors[field.key] = `Минимум ${field.min} мм`
    } else if (value > field.max) {
      errors[field.key] = `Максимум ${field.max} мм`
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
  const hardwarePrice = (hardwareClass.price * hardware.price) / 100
  const hasSurcharge = height > catalog.services.heightSurchargeAfter
  const surchargeFactor = hasSurcharge ? 1 + catalog.services.heightSurchargePercent / 100 : 1
  const applySurcharge = (value: number) => roundToTen(value * surchargeFactor)
  const productMarkupFactor = 1 + Math.max(0, Number(catalog.services.productMarkupPercent) || 0) / 100
  const hardwareMarkupFactor = 1 + Math.max(0, Number(catalog.services.hardwareMarkupPercent) || 0) / 100

  const baseProduct = Object.keys(errors).length > 0
    ? 0
    : ceilToTen((glassPrice + construction.basePrice) * productMarkupFactor + hardwarePrice * hardwareMarkupFactor)
  const baseProductWithSurcharge = applySurcharge(baseProduct)
  const baseInstallation = form.installation ? construction.installationPrice : 0
  const deliveryBase =
    form.delivery && form.deliveryZone === 'outside'
      ? catalog.services.deliveryBase + Math.max(0, Number(form.deliveryKm) || 0) * catalog.services.deliveryKmRate
      : catalog.services.deliveryBase
  const baseDelivery = form.delivery ? deliveryBase : 0
  const designerPercent = Math.max(0, Number(catalog.services.designerPercent) || 0)
  const designerFactor = form.designerEnabled ? 1 + designerPercent / 100 : 1
  const product = roundToTen(baseProductWithSurcharge * designerFactor)
  const installation = roundToTen(baseInstallation * designerFactor)
  const delivery = roundToTen(baseDelivery * designerFactor)
  const subtotal = product + installation + delivery
  const designer = subtotal - baseProductWithSurcharge - baseInstallation - baseDelivery
  const discountPercent = Math.min(100, Math.max(0, Number(form.discountPercent) || 0))
  const total = form.discountEnabled
    ? roundToTen(subtotal - (subtotal / 100) * discountPercent)
    : subtotal
  const discount = subtotal - total
  const lines = buildCalculationLines(product, installation, delivery, discount, discountPercent)

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
  const discountLabel = results
    .flatMap((result) => result.lines)
    .find((line) => line.label.startsWith('Скидка'))?.label
  const discountPercent = Number(discountLabel?.match(/[\d,.]+/)?.[0]?.replace(',', '.') ?? 0)
  const lines = buildCalculationLines(product, installation, delivery, discount, discountPercent)

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

const createShowerQuoteItem = (catalog: PricingCatalog, draft: ShowerQuoteDraftItem): ShowerQuoteItem => {
  const construction = getConstruction(catalog, draft.form.constructionId)
  const glass = getOption(catalog.glass, draft.form.glassId)
  const hardware = getOption(catalog.hardware, draft.form.hardwareId)
  const hardwareClass = getOption(catalog.hardwareClass, draft.form.hardwareClassId)

  return {
    id: crypto.randomUUID(),
    kind: 'shower',
    quantity: normalizeQuoteQuantity(draft.quantity),
    form: draft.form,
    result: draft.result,
    constructionTitle: construction.title,
    glassLabel: glass.label,
    hardwareLabel: hardware.label,
    hardwareClassLabel: hardwareClass.label,
  }
}

const createMirrorQuoteItem = (
  catalog: MirrorPricingCatalog,
  draft: MirrorQuoteDraftItem,
): MirrorQuoteItem => ({
  id: crypto.randomUUID(),
  kind: 'mirror',
  quantity: normalizeQuoteQuantity(draft.quantity),
  form: draft.form,
  result: draft.result,
  mirrorTitle: getMirrorTitle(draft.form),
  materialLabel: getMirrorMaterial(catalog, draft.form.materialId).label,
  serviceLines: getMirrorCalculatedOptions(catalog, draft.form).map((item) => ({
    label: item.label,
    quantity: item.quantity,
    unit: item.unit,
    unitLabel: item.unitLabel,
    visibleInQuote: item.visibleInQuote,
  })),
})

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
        .filter((line) => line.visibleInQuote)
        .map((line, index) => ({
          id: `${item.id}:service:${index}`,
          label: line.label,
          value: `${line.quantity.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${line.unitLabel}`,
        })),
    ]
  }

  const construction = getConstruction(defaultCatalog, item.form.constructionId)
  const details: QuoteDetailLine[] = [
    ...construction.fields.map((field) => ({
      id: `${item.id}:dimension:${field.key}`,
      label: field.label,
      value: `${item.form.dimensions[field.key] ?? 0} мм`,
    })),
    { id: `${item.id}:glass`, label: 'Стекло', value: item.glassLabel },
    { id: `${item.id}:hardware`, label: 'Фурнитура', value: item.hardwareLabel },
    { id: `${item.id}:hardware-class`, label: 'Класс фурнитуры', value: item.hardwareClassLabel },
  ]
  return details
}

export const getQuoteTotal = (quote: Quote) => Number.isFinite(quote.manualTotal)
  ? Math.max(0, Number(quote.manualTotal))
  : quote.result.total

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

export const createQuote = (
  catalog: PricingCatalog,
  mirrorCatalog: MirrorPricingCatalog,
  drafts: QuoteDraftItem[],
): Quote => {
  if (drafts.length === 0) throw new Error('КП должно содержать хотя бы одну позицию')
  const items = drafts.map((draft) => draft.kind === 'mirror'
    ? createMirrorQuoteItem(mirrorCatalog, draft)
    : createShowerQuoteItem(catalog, draft))
  const firstItem = items[0]
  const createdAt = new Date().toISOString()
  const id = crypto.randomUUID()

  return {
    ...firstItem,
    id,
    number: `КП-${new Date().getFullYear()}-${id.slice(0, 4).toUpperCase()}`,
    createdAt,
    status: 'new',
    result: combineCalculationResults(items.map((item) => (
      multiplyCalculationResult(item.result, getQuoteItemQuantity(item))
    ))),
    items,
  }
}

export const updateQuoteManually = (quote: Quote, patch: ManualQuotePatch): Quote => {
  const itemsById = new Map(getQuoteItems(quote).map((item) => [item.id, item]))
  const discountPercent = Math.min(100, Math.max(0, Number(patch.discountPercent) || 0))
  const updatedItems = patch.items.flatMap((itemPatch): QuoteItem[] => {
    const item = itemsById.get(itemPatch.id)
    if (!item) return []
    const product = Math.max(0, Number(itemPatch.product) || 0)
    const delivery = Math.max(0, Number(itemPatch.delivery) || 0)
    const quantity = normalizeQuoteQuantity(itemPatch.quantity)
    const subtotal = product + delivery
    const total = patch.discountEnabled
      ? roundToTen(subtotal * (1 - discountPercent / 100))
      : subtotal
    const discount = subtotal - total
    const sharedForm = {
      clientName: patch.clientName,
      clientPhone: patch.clientPhone,
      note: patch.note,
      discountEnabled: patch.discountEnabled,
      discountPercent,
    }
    const result: CalculationResult = {
      ...item.result,
      product,
      installation: 0,
      delivery,
      manager: 0,
      designer: 0,
      subtotal,
      discount,
      total,
      lines: buildCalculationLines(product, 0, delivery, discount, discountPercent),
    }

    if (isMirrorQuoteItem(item)) {
      const form: MirrorForm = { ...item.form, ...sharedForm }
      return [{ ...item, quantity, form, result, mirrorTitle: itemPatch.title, details: itemPatch.details }]
    }
    const form: CalculatorForm = { ...item.form, ...sharedForm }
    return [{ ...item, quantity, form, result, constructionTitle: itemPatch.title, details: itemPatch.details }]
  })
  if (updatedItems.length === 0) return quote
  const firstItem = updatedItems[0]
  const result = combineCalculationResults(updatedItems.map((item) => (
    multiplyCalculationResult(item.result, getQuoteItemQuantity(item))
  )))
  const manualTotal = patch.manualTotalEnabled
    ? Math.max(0, Number(patch.manualTotal) || 0)
    : undefined

  return {
    ...firstItem,
    id: quote.id,
    number: quote.number,
    createdAt: quote.createdAt,
    status: quote.status,
    result,
    items: updatedItems,
    manualTotal,
  }
}
