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
  subtotal: number
  discount: number
  total: number
  glassArea: number
  hardwarePrice: number
  hasSurcharge: boolean
  errors: Record<string, string>
  lines: CalculationLine[]
}

export type Quote = {
  id: string
  number: string
  createdAt: string
  status: 'new' | 'sent' | 'accepted' | 'archived'
  form: CalculatorForm
  result: CalculationResult
  constructionTitle: string
  glassLabel: string
  hardwareLabel: string
  hardwareClassLabel: string
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
  const product = applySurcharge(baseProduct)
  const installation = form.installation ? applySurcharge(catalog.services.installation) : 0
  const deliveryBase =
    form.delivery && form.deliveryZone === 'outside'
      ? catalog.services.deliveryBase + Math.max(0, Number(form.deliveryKm) || 0) * catalog.services.deliveryKmRate
      : catalog.services.deliveryBase
  const delivery = form.delivery ? applySurcharge(deliveryBase) : 0
  const subtotal = product + installation + delivery
  const total = roundToTen(subtotal - (subtotal / 100) * catalog.services.discountPercent)
  const discount = subtotal - total

  return {
    product,
    installation,
    delivery,
    subtotal,
    discount,
    total,
    glassArea,
    hardwarePrice,
    hasSurcharge,
    errors,
    lines: [
      { label: 'Стоимость изделий', value: product },
      { label: 'Монтаж', value: installation },
      { label: 'Доставка', value: delivery },
      { label: 'Сумма без скидки', value: subtotal },
      { label: `Скидка ${catalog.services.discountPercent}%`, value: discount },
    ],
  }
}

export const createQuote = (catalog: PricingCatalog, form: CalculatorForm, result: CalculationResult): Quote => {
  const construction = getConstruction(catalog, form.constructionId)
  const glass = getOption(catalog.glass, form.glassId)
  const hardware = getOption(catalog.hardware, form.hardwareId)
  const hardwareClass = getOption(catalog.hardwareClass, form.hardwareClassId)
  const createdAt = new Date().toISOString()
  const id = crypto.randomUUID()

  return {
    id,
    number: `КП-${new Date().getFullYear()}-${id.slice(0, 4).toUpperCase()}`,
    createdAt,
    status: 'new',
    form,
    result,
    constructionTitle: construction.title,
    glassLabel: glass.label,
    hardwareLabel: hardware.label,
    hardwareClassLabel: hardwareClass.label,
  }
}
