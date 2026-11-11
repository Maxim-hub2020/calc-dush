import type { CalculationResult } from './calculator'
import { roundMoneyUp } from './money'
import {
  mirrorUnitLabels,
  type MirrorMaterial,
  type MirrorPricingCatalog,
  type MirrorService,
  type MirrorServiceGroup,
  type MirrorUnit,
} from './mirrorPricing'

export type MirrorOptionSelection = {
  id: string
  serviceId: string
  quantity: number
  manualQuantity?: number
}

export type MirrorGroupSelection = {
  id: string
  groupId: string
  itemQuantities?: Record<string, number>
}

export type MirrorForm = {
  width: number
  height: number
  materialId: string
  options: MirrorOptionSelection[]
  groups?: MirrorGroupSelection[]
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
  serviceId: string
  label: string
  unit: MirrorUnit
  unitLabel: string
  quantity: number
  automaticQuantity: number
  unitPrice: number
  total: number
  category: MirrorService['category']
  visibleInQuote: boolean
  groupId?: string
  groupLabel?: string
  groupSelectionId?: string
}

export const MIRROR_MIN_WIDTH_MM = 70
export const MIRROR_MIN_HEIGHT_MM = 100
export const MIRROR_MAX_WIDTH_MM = 2070
export const MIRROR_MAX_HEIGHT_MM = 3140

const roundToTen = (value: number) => Math.round(value / 10) * 10

export const getMirrorMaterial = (catalog: MirrorPricingCatalog, id: string): MirrorMaterial =>
  catalog.materials.find((item) => item.id === id) ?? catalog.materials[0]

export const getMirrorService = (catalog: MirrorPricingCatalog, id: string): MirrorService =>
  catalog.services.find((item) => item.id === id) ?? catalog.services[0]

export const getMirrorServiceGroup = (catalog: MirrorPricingCatalog, id: string): MirrorServiceGroup | undefined =>
  catalog.groups.find((item) => item.id === id)

export const createInitialMirrorForm = (catalog: MirrorPricingCatalog, customer?: Partial<MirrorForm>): MirrorForm => ({
  width: 800,
  height: 1200,
  materialId: catalog.materials.find((item) => item.id === 'mirror-silver-4')?.id ?? catalog.materials[0].id,
  options: [],
  groups: [],
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
  groups: (form.groups ?? []).map((group) => ({
    ...group,
    itemQuantities: group.itemQuantities ? { ...group.itemQuantities } : undefined,
  })),
})

export const mirrorArea = (form: Pick<MirrorForm, 'width' | 'height'>) =>
  Math.max(0, Number(form.width) || 0) * Math.max(0, Number(form.height) || 0) / 1_000_000

export const mirrorPerimeter = (form: Pick<MirrorForm, 'width' | 'height'>) =>
  2 * (Math.max(0, Number(form.width) || 0) + Math.max(0, Number(form.height) || 0)) / 1000

export const getMirrorAutomaticOptionQuantity = (form: MirrorForm, service: MirrorService, requested: number) => {
  const quantity = Math.max(0, Number(requested) || 0)
  if (service.unit === 'area') return mirrorArea(form) * quantity
  if (service.unit === 'perimeter') return mirrorPerimeter(form) * quantity
  return quantity
}

export const getMirrorOptionQuantity = (
  form: MirrorForm,
  service: MirrorService,
  requested: number,
  manualQuantity?: number,
) => {
  const normalizedManualQuantity = Number(manualQuantity)
  return Number.isFinite(normalizedManualQuantity) && normalizedManualQuantity >= 0
    ? normalizedManualQuantity
    : getMirrorAutomaticOptionQuantity(form, service, requested)
}

const calculateMirrorOption = (
  catalog: MirrorPricingCatalog,
  form: MirrorForm,
  selection: MirrorOptionSelection,
  group?: { id: string; label: string; selectionId: string },
): MirrorCalculatedOption => {
  const service = getMirrorService(catalog, selection.serviceId)
  const automaticQuantity = getMirrorAutomaticOptionQuantity(form, service, selection.quantity)
  const quantity = getMirrorOptionQuantity(form, service, selection.quantity, selection.manualQuantity)
  return {
    id: selection.id,
    serviceId: service.id,
    label: service.label,
    unit: service.unit,
    unitLabel: mirrorUnitLabels[service.unit],
    quantity,
    automaticQuantity,
    unitPrice: service.price,
    total: service.price * quantity,
    category: service.category,
    visibleInQuote: service.visibleInQuote,
    groupId: group?.id,
    groupLabel: group?.label,
    groupSelectionId: group?.selectionId,
  }
}

export const getMirrorCalculatedOptions = (
  catalog: MirrorPricingCatalog,
  form: MirrorForm,
): MirrorCalculatedOption[] => {
  const directOptions = form.options.map((selection) => calculateMirrorOption(catalog, form, selection))
  const groupOptions = (form.groups ?? []).flatMap((selection) => {
    const group = getMirrorServiceGroup(catalog, selection.groupId)
    if (!group) return []
    return group.items.map((item) => calculateMirrorOption(
      catalog,
      form,
      {
        id: `${selection.id}:${item.id}`,
        serviceId: item.serviceId,
        quantity: item.quantity,
        manualQuantity: selection.itemQuantities?.[item.id],
      },
      { id: group.id, label: group.label, selectionId: selection.id },
    ))
  })
  return [...directOptions, ...groupOptions]
}

export const getMirrorCalculatedGroupTotal = (
  catalog: MirrorPricingCatalog,
  form: MirrorForm,
  selectionId: string,
) => getMirrorCalculatedOptions(catalog, form)
  .filter((option) => option.groupSelectionId === selectionId)
  .reduce((sum, option) => sum + option.total, 0)

export const getMirrorServiceSellingUnitPrice = (
  catalog: MirrorPricingCatalog,
  service: Pick<MirrorService, 'category' | 'price'>,
) => service.category === 'work'
  ? service.price * (1 + Math.max(0, Number(catalog.settings.serviceMarkupPercent) || 0) / 100)
  : service.price

export const getMirrorCalculatedOptionSellingTotal = (
  catalog: MirrorPricingCatalog,
  option: Pick<MirrorCalculatedOption, 'category' | 'total'>,
) => option.category === 'work'
  ? option.total * (1 + Math.max(0, Number(catalog.settings.serviceMarkupPercent) || 0) / 100)
  : option.total

export const getMirrorCalculatedGroupSellingTotal = (
  catalog: MirrorPricingCatalog,
  form: MirrorForm,
  selectionId: string,
) => getMirrorCalculatedOptions(catalog, form)
  .filter((option) => option.groupSelectionId === selectionId)
  .reduce((sum, option) => sum + getMirrorCalculatedOptionSellingTotal(catalog, option), 0)

export const getMirrorTitle = (form: Pick<MirrorForm, 'width' | 'height'>) =>
  `Зеркало ${Math.max(0, Number(form.width) || 0)} × ${Math.max(0, Number(form.height) || 0)} мм`

export const getMirrorProductTitle = (
  catalog: MirrorPricingCatalog,
  form: Pick<MirrorForm, 'width' | 'height' | 'materialId'>,
) => `${getMirrorMaterial(catalog, form.materialId).label} · ${Math.max(0, Number(form.width) || 0)} × ${Math.max(0, Number(form.height) || 0)} мм`

export type MirrorPricingComponents = {
  area: number
  material: MirrorMaterial
  options: MirrorCalculatedOption[]
  errors: Record<string, string>
  rawMaterial: number
  rawWork: number
  materialMarkupPercent: number
  serviceMarkupPercent: number
  baseProduct: number
  baseInstallation: number
  baseSubtotal: number
  managerPercent: number
  designerPercent: number
  manager: number
  designer: number
  commissionFactor: number
  productBeforeRounding: number
  installation: number
  subtotal: number
  discountPercent: number
  discount: number
  total: number
  product: number
}

export const getMirrorPricingComponents = (
  catalog: MirrorPricingCatalog,
  form: MirrorForm,
): MirrorPricingComponents => {
  const errors: Record<string, string> = {}
  const width = Number(form.width)
  const height = Number(form.height)
  if (!Number.isFinite(width) || width < MIRROR_MIN_WIDTH_MM) errors.width = `Минимум ${MIRROR_MIN_WIDTH_MM} мм`
  if (width > MIRROR_MAX_WIDTH_MM) errors.width = `Максимум ${MIRROR_MAX_WIDTH_MM} мм`
  if (!Number.isFinite(height) || height < MIRROR_MIN_HEIGHT_MM) errors.height = `Минимум ${MIRROR_MIN_HEIGHT_MM} мм`
  if (height > MIRROR_MAX_HEIGHT_MM) errors.height = `Максимум ${MIRROR_MAX_HEIGHT_MM} мм`

  const area = mirrorArea(form)
  const material = getMirrorMaterial(catalog, form.materialId)
  const options = getMirrorCalculatedOptions(catalog, form)
  const valid = Object.keys(errors).length === 0
  const rawMaterial = valid ? area * material.price : 0
  const rawWork = valid
    ? options.filter((item) => item.category === 'work').reduce((sum, item) => sum + item.total, 0)
    : 0
  const materialMarkupPercent = Math.max(0, Number(catalog.settings.materialMarkupPercent) || 0)
  const serviceMarkupPercent = Math.max(0, Number(catalog.settings.serviceMarkupPercent) || 0)
  const baseProduct = rawMaterial * (1 + materialMarkupPercent / 100)
  const baseInstallation = rawWork * (1 + serviceMarkupPercent / 100)
  const baseSubtotal = baseProduct + baseInstallation
  const managerPercent = form.managerEnabled ? Math.max(0, Number(catalog.settings.managerPercent) || 0) : 0
  const designerPercent = form.designerEnabled ? Math.max(0, Number(catalog.settings.designerPercent) || 0) : 0
  const manager = baseSubtotal * managerPercent / 100
  const designer = baseSubtotal * designerPercent / 100
  const commissionFactor = baseSubtotal > 0 ? (baseSubtotal + manager + designer) / baseSubtotal : 1
  const productBeforeRounding = roundToTen(baseProduct * commissionFactor)
  const installation = roundToTen(baseInstallation * commissionFactor)
  const subtotal = roundMoneyUp(productBeforeRounding + installation)
  const product = subtotal - installation
  const discountPercent = Math.min(100, Math.max(0, Number(form.discountPercent) || 0))
  const total = form.discountEnabled ? roundMoneyUp(subtotal * (1 - discountPercent / 100)) : subtotal
  const discount = subtotal - total

  return {
    area,
    material,
    options,
    errors,
    rawMaterial,
    rawWork,
    materialMarkupPercent,
    serviceMarkupPercent,
    baseProduct,
    baseInstallation,
    baseSubtotal,
    managerPercent,
    designerPercent,
    manager,
    designer,
    commissionFactor,
    productBeforeRounding,
    installation,
    subtotal,
    discountPercent,
    discount,
    total,
    product,
  }
}

export const calculateMirrorQuote = (catalog: MirrorPricingCatalog, form: MirrorForm): CalculationResult => {
  const pricing = getMirrorPricingComponents(catalog, form)
  const delivery = 0
  const lines = [
    { label: 'Стоимость изделия', value: pricing.product + pricing.installation },
    { label: 'Доставка', value: delivery },
  ]
  if (pricing.discount > 0) lines.push({ label: 'Скидка', value: pricing.discount })

  return {
    product: pricing.product,
    installation: pricing.installation,
    delivery,
    manager: roundToTen(pricing.manager),
    designer: roundToTen(pricing.designer),
    subtotal: pricing.subtotal,
    discount: pricing.discount,
    total: pricing.total,
    glassArea: pricing.area,
    hardwarePrice: 0,
    hasSurcharge: false,
    errors: pricing.errors,
    lines,
  }
}
