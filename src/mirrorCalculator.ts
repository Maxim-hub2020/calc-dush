import type { CalculationResult } from './calculator'
import {
  mirrorUnitLabels,
  type MirrorMaterial,
  type MirrorPricingCatalog,
  type MirrorService,
  type MirrorUnit,
} from './mirrorPricing'

export type MirrorOptionSelection = {
  id: string
  serviceId: string
  quantity: number
}

export type MirrorForm = {
  width: number
  height: number
  materialId: string
  options: MirrorOptionSelection[]
  managerEnabled: boolean
  discountEnabled: boolean
  discountPercent: number
  designerEnabled: boolean
  clientName: string
  clientPhone: string
  note: string
}

export type MirrorCalculatedOption = {
  id: string
  label: string
  unit: MirrorUnit
  unitLabel: string
  quantity: number
  unitPrice: number
  total: number
  category: MirrorService['category']
  visibleInQuote: boolean
}

const roundToTen = (value: number) => Math.round(value / 10) * 10

export const getMirrorMaterial = (catalog: MirrorPricingCatalog, id: string): MirrorMaterial =>
  catalog.materials.find((item) => item.id === id) ?? catalog.materials[0]

export const getMirrorService = (catalog: MirrorPricingCatalog, id: string): MirrorService =>
  catalog.services.find((item) => item.id === id) ?? catalog.services[0]

export const createInitialMirrorForm = (catalog: MirrorPricingCatalog, customer?: Partial<MirrorForm>): MirrorForm => ({
  width: 800,
  height: 1200,
  materialId: catalog.materials.find((item) => item.id === 'mirror-silver-4')?.id ?? catalog.materials[0].id,
  options: [],
  managerEnabled: false,
  discountEnabled: customer?.discountEnabled ?? false,
  discountPercent: customer?.discountPercent ?? catalog.settings.discountPercent,
  designerEnabled: customer?.designerEnabled ?? false,
  clientName: customer?.clientName ?? '',
  clientPhone: customer?.clientPhone ?? '',
  note: customer?.note ?? '',
})

export const cloneMirrorForm = (form: MirrorForm): MirrorForm => ({
  ...form,
  options: form.options.map((option) => ({ ...option })),
})

export const mirrorArea = (form: Pick<MirrorForm, 'width' | 'height'>) =>
  Math.max(0, Number(form.width) || 0) * Math.max(0, Number(form.height) || 0) / 1_000_000

export const mirrorPerimeter = (form: Pick<MirrorForm, 'width' | 'height'>) =>
  2 * (Math.max(0, Number(form.width) || 0) + Math.max(0, Number(form.height) || 0)) / 1000

export const getMirrorOptionQuantity = (form: MirrorForm, service: MirrorService, requested: number) => {
  if (service.unit === 'area') return mirrorArea(form)
  if (service.unit === 'perimeter') return mirrorPerimeter(form)
  return Math.max(0, Number(requested) || 0)
}

export const getMirrorCalculatedOptions = (
  catalog: MirrorPricingCatalog,
  form: MirrorForm,
): MirrorCalculatedOption[] => form.options.map((selection) => {
  const service = getMirrorService(catalog, selection.serviceId)
  const quantity = getMirrorOptionQuantity(form, service, selection.quantity)
  return {
    id: selection.id,
    label: service.label,
    unit: service.unit,
    unitLabel: mirrorUnitLabels[service.unit],
    quantity,
    unitPrice: service.price,
    total: service.price * quantity,
    category: service.category,
    visibleInQuote: service.visibleInQuote,
  }
})

export const getMirrorTitle = (form: Pick<MirrorForm, 'width' | 'height'>) =>
  `Зеркало ${Math.max(0, Number(form.width) || 0)} × ${Math.max(0, Number(form.height) || 0)} мм`

export const calculateMirrorQuote = (catalog: MirrorPricingCatalog, form: MirrorForm): CalculationResult => {
  const errors: Record<string, string> = {}
  const width = Number(form.width)
  const height = Number(form.height)
  if (!Number.isFinite(width) || width < 100) errors.width = 'Минимум 100 мм'
  if (width > 4000) errors.width = 'Максимум 4000 мм'
  if (!Number.isFinite(height) || height < 100) errors.height = 'Минимум 100 мм'
  if (height > 4000) errors.height = 'Максимум 4000 мм'

  const area = mirrorArea(form)
  const material = getMirrorMaterial(catalog, form.materialId)
  const options = getMirrorCalculatedOptions(catalog, form)
  const valid = Object.keys(errors).length === 0
  const rawMaterial = valid ? area * material.price : 0
  const rawWork = valid
    ? options.filter((item) => item.category === 'work').reduce((sum, item) => sum + item.total, 0)
    : 0
  const rawDelivery = valid
    ? options.filter((item) => item.category === 'delivery').reduce((sum, item) => sum + item.total, 0)
    : 0

  const baseProduct = rawMaterial * (1 + Math.max(0, catalog.settings.materialMarkupPercent) / 100)
  const baseInstallation = rawWork * (1 + Math.max(0, catalog.settings.serviceMarkupPercent) / 100)
  const baseDelivery = rawDelivery * (1 + Math.max(0, catalog.settings.serviceMarkupPercent) / 100)
  const baseSubtotal = baseProduct + baseInstallation + baseDelivery
  const manager = form.managerEnabled ? baseSubtotal * Math.max(0, catalog.settings.managerPercent) / 100 : 0
  const designer = form.designerEnabled ? baseSubtotal * Math.max(0, catalog.settings.designerPercent) / 100 : 0
  const commissionFactor = baseSubtotal > 0 ? (baseSubtotal + manager + designer) / baseSubtotal : 1
  const product = roundToTen(baseProduct * commissionFactor)
  const installation = roundToTen(baseInstallation * commissionFactor)
  const delivery = roundToTen(baseDelivery * commissionFactor)
  const subtotal = product + installation + delivery
  const discountPercent = Math.min(100, Math.max(0, Number(form.discountPercent) || 0))
  const total = form.discountEnabled ? roundToTen(subtotal * (1 - discountPercent / 100)) : subtotal
  const discount = subtotal - total
  const lines = [
    { label: 'Стоимость изделия', value: product + installation },
    { label: 'Доставка', value: delivery },
  ]
  if (discount > 0) lines.push({ label: `Скидка ${discountPercent}%`, value: discount })

  return {
    product,
    installation,
    delivery,
    manager: roundToTen(manager),
    designer: roundToTen(designer),
    subtotal,
    discount,
    total,
    glassArea: area,
    hardwarePrice: 0,
    hasSurcharge: false,
    errors,
    lines,
  }
}
