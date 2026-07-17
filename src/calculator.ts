import type { Construction, PriceOption, PricingCatalog } from './pricing'

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

export type QuoteItem = {
  id: string
  form: CalculatorForm
  result: CalculationResult
  constructionTitle: string
  glassLabel: string
  hardwareLabel: string
  hardwareClassLabel: string
}

export type Quote = QuoteItem & {
  id: string
  number: string
  createdAt: string
  status: 'new' | 'sent' | 'accepted' | 'archived'
  items?: QuoteItem[]
}

export type QuoteDraftItem = {
  form: CalculatorForm
  result: CalculationResult
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

  const baseProduct = Object.keys(errors).length > 0 ? 0 : ceilToTen(glassPrice + hardwarePrice) + construction.basePrice
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
  const lines = [
    { label: 'Стоимость изделий', value: product },
    { label: 'Монтаж', value: installation },
    { label: 'Доставка', value: delivery },
    { label: 'Сумма без скидки', value: subtotal },
  ]
  if (form.discountEnabled) lines.push({ label: `Скидка ${discountPercent}%`, value: discount })

  return {
    product,
    installation,
    delivery,
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
  const lines = [
    { label: 'Стоимость изделий', value: product },
    { label: 'Монтаж', value: installation },
    { label: 'Доставка', value: delivery },
    { label: 'Сумма без скидки', value: subtotal },
  ]
  const discountLabel = results
    .flatMap((result) => result.lines)
    .find((line) => line.label.startsWith('Скидка'))?.label
  if (discount > 0) lines.push({ label: discountLabel ?? 'Скидка', value: discount })

  return {
    product,
    installation,
    delivery,
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

const createQuoteItem = (catalog: PricingCatalog, draft: QuoteDraftItem): QuoteItem => {
  const construction = getConstruction(catalog, draft.form.constructionId)
  const glass = getOption(catalog.glass, draft.form.glassId)
  const hardware = getOption(catalog.hardware, draft.form.hardwareId)
  const hardwareClass = getOption(catalog.hardwareClass, draft.form.hardwareClassId)

  return {
    id: crypto.randomUUID(),
    form: draft.form,
    result: draft.result,
    constructionTitle: construction.title,
    glassLabel: glass.label,
    hardwareLabel: hardware.label,
    hardwareClassLabel: hardwareClass.label,
  }
}

export const getQuoteItems = (quote: Quote): QuoteItem[] => {
  if (quote.items?.length) return quote.items
  return [{
    id: quote.id,
    form: quote.form,
    result: quote.result,
    constructionTitle: quote.constructionTitle,
    glassLabel: quote.glassLabel,
    hardwareLabel: quote.hardwareLabel,
    hardwareClassLabel: quote.hardwareClassLabel,
  }]
}

export const createQuote = (catalog: PricingCatalog, drafts: QuoteDraftItem[]): Quote => {
  if (drafts.length === 0) throw new Error('КП должно содержать хотя бы одну позицию')
  const items = drafts.map((draft) => createQuoteItem(catalog, draft))
  const firstItem = items[0]
  const createdAt = new Date().toISOString()
  const id = crypto.randomUUID()

  return {
    ...firstItem,
    id,
    number: `КП-${new Date().getFullYear()}-${id.slice(0, 4).toUpperCase()}`,
    createdAt,
    status: 'new',
    result: combineCalculationResults(items.map((item) => item.result)),
    items,
  }
}
