import {
  getConstruction,
  getConstructionHardwareBasePrice,
  getConstructionHardwareComponents,
  getOption,
  money,
  roundMoneyUp,
  type CalculatorForm,
  type CalculationResult,
  type QuoteDelivery,
} from './calculator'
import {
  getMirrorCalculatedOptions,
  getMirrorMaterial,
  mirrorArea,
  type MirrorForm,
} from './mirrorCalculator'
import type { MirrorPricingCatalog } from './mirrorPricing'
import type { PricingCatalog } from './pricing'

export type AdminCalculationRow = {
  label: string
  formula: string
  value: string
  emphasis?: boolean
}

export type AdminCalculationSection = {
  title: string
  rows: AdminCalculationRow[]
}

export type AdminCalculationBreakdown = {
  title: string
  sections: AdminCalculationSection[]
}

type OrderCalculationItem = {
  label: string
  total: number
}

const roundToTen = (value: number) => Math.round(value / 10) * 10
const ceilToTen = (value: number) => Math.ceil(value / 10) * 10
const number = (value: number, maximumFractionDigits = 3) => new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits,
}).format(Number.isFinite(value) ? value : 0)

const percentFactor = (value: number) => 1 + Math.max(0, Number(value) || 0) / 100
const discountPercent = (value: number) => Math.min(100, Math.max(0, Number(value) || 0))

export const buildShowerCalculationBreakdown = (
  catalog: PricingCatalog,
  form: CalculatorForm,
  quantity: number,
  unitResult: CalculationResult,
): AdminCalculationBreakdown => {
  const construction = getConstruction(catalog, form.constructionId)
  const glass = getOption(catalog.glass, form.glassId)
  const hardware = getOption(catalog.hardware, form.hardwareId)
  const hardwareClass = getOption(catalog.hardwareClass, form.hardwareClassId)
  const hardwareComponents = getConstructionHardwareComponents(catalog, construction, glass.thickness)
  const heightField = construction.fields.find((field) => field.key.startsWith('HEIGHT'))
  const height = Number(form.dimensions[heightField?.key ?? 'HEIGHT_0'] ?? 0)
  const widths = construction.fields
    .filter((field) => field.key.startsWith('WIDTH'))
    .map((field) => Number(form.dimensions[field.key] ?? 0))
  const panelAreas = widths.map((width) => width / 1000 * height / 1000)
  const panelPrices = panelAreas.map((area) => Math.round(area * glass.price))
  const glassArea = panelAreas.reduce((sum, area) => sum + area, 0)
  const glassPrice = panelPrices.reduce((sum, price) => sum + price, 0)
  const hardwareBasePrice = getConstructionHardwareBasePrice(
    catalog,
    construction,
    hardwareClass.price,
    glass.thickness,
  )
  const hasHardwareComposition = hardwareComponents.length > 0
  const fallbackConstructionBase = hasHardwareComposition ? 0 : Math.max(0, Number(construction.basePrice) || 0)
  const hardwareColorMarkup = Math.max(0, Number(hardware.price) || 0)
  const hardwarePrice = hardwareBasePrice * percentFactor(hardwareColorMarkup)
  const productMarkup = Math.max(0, Number(catalog.services.productMarkupPercent) || 0)
  const hardwareMarkup = Math.max(0, Number(catalog.services.hardwareMarkupPercent) || 0)
  const productPart = (glassPrice + fallbackConstructionBase) * percentFactor(productMarkup)
  const hardwarePart = hardwarePrice * percentFactor(hardwareMarkup)
  const valid = Object.keys(unitResult.errors).length === 0
  const baseProduct = valid ? ceilToTen(productPart + hardwarePart) : 0
  const hasSurcharge = height > catalog.services.heightSurchargeAfter
  const surchargePercent = hasSurcharge ? catalog.services.heightSurchargePercent : 0
  const productWithSurcharge = roundToTen(baseProduct * percentFactor(surchargePercent))
  const baseInstallation = form.installation ? construction.installationPrice : 0
  const designerPercent = form.designerEnabled
    ? Math.max(0, Number(catalog.services.designerPercent) || 0)
    : 0
  const productBeforeRounding = roundToTen(productWithSurcharge * percentFactor(designerPercent))
  const installation = roundToTen(baseInstallation * percentFactor(designerPercent))
  const subtotal = roundMoneyUp(productBeforeRounding + installation)
  const appliedDiscount = form.discountEnabled ? discountPercent(form.discountPercent) : 0
  const total = form.discountEnabled
    ? roundMoneyUp(subtotal - subtotal / 100 * appliedDiscount)
    : subtotal
  const normalizedQuantity = Math.max(1, Math.floor(Number(quantity) || 1))

  const dimensionRows: AdminCalculationRow[] = panelAreas.map((area, index) => ({
    label: `Стекло ${index + 1}`,
    formula: `${number(widths[index], 0)} / 1000 × ${number(height, 0)} / 1000`,
    value: `${number(area)} м²`,
  }))
  dimensionRows.push(
    {
      label: 'Общая площадь стекла',
      formula: panelAreas.length > 0 ? panelAreas.map((area) => number(area)).join(' + ') : '0',
      value: `${number(glassArea)} м²`,
    },
    {
      label: `Стекло «${glass.label}»`,
      formula: panelAreas.length > 0
        ? panelAreas.map((area) => `round(${number(area)} × ${money(glass.price)}/м²)`).join(' + ')
        : '0',
      value: money(glassPrice),
    },
  )

  return {
    title: construction.shortTitle,
    sections: [
      {
        title: 'Размеры и стекло',
        rows: dimensionRows,
      },
      {
        title: 'Конструкция и фурнитура',
        rows: [
          ...(!hasHardwareComposition ? [{
            label: 'Резервная база конструкции',
            formula: construction.title,
            value: money(fallbackConstructionBase),
          }] : []),
          {
            label: 'Стекло с наценкой',
            formula: `(${money(glassPrice)} + ${money(fallbackConstructionBase)}) × (1 + ${number(productMarkup)}%)`,
            value: money(productPart),
          },
          ...(
            hardwareComponents.length > 0
              ? hardwareComponents.map((component) => ({
                  label: component.item.label,
                  formula: `${number(component.quantity)} шт. × ${money(component.item.price)}`,
                  value: money(component.total),
                }))
              : [{
                  label: `Класс «${hardwareClass.label}»`,
                  formula: 'Состав конструкции пока не заполнен',
                  value: money(hardwareClass.price),
                }]
          ),
          {
            label: 'Сумма состава фурнитуры в хроме',
            formula: hardwareComponents.length > 0 ? 'Сумма всех позиций выше' : `Класс «${hardwareClass.label}»`,
            value: money(hardwareBasePrice),
          },
          {
            label: `Цвет «${hardware.label}»`,
            formula: `${money(hardwareBasePrice)} × (1 + ${number(hardwareColorMarkup)}%)`,
            value: money(hardwarePrice),
          },
          {
            label: 'Фурнитура с наценкой',
            formula: `${money(hardwarePrice)} × (1 + ${number(hardwareMarkup)}%)`,
            value: money(hardwarePart),
          },
          {
            label: 'Базовая стоимость',
            formula: valid
              ? `ceil10(${money(productPart)} + ${money(hardwarePart)})`
              : 'Расчёт остановлен: проверьте размеры',
            value: money(baseProduct),
            emphasis: true,
          },
        ],
      },
      {
        title: 'Надбавки и итог позиции',
        rows: [
          {
            label: 'Высотная надбавка',
            formula: hasSurcharge
              ? `round10(${money(baseProduct)} × (1 + ${number(surchargePercent)}%)), высота ${number(height, 0)} мм`
              : `${number(height, 0)} мм ≤ ${number(catalog.services.heightSurchargeAfter, 0)} мм, не применяется`,
            value: money(productWithSurcharge),
          },
          {
            label: 'Монтаж',
            formula: form.installation ? construction.title : 'Не выбран',
            value: money(baseInstallation),
          },
          {
            label: 'Дизайнер',
            formula: form.designerEnabled
              ? `изделие и монтаж × (1 + ${number(designerPercent)}%), каждый результат round10`
              : 'Не применяется',
            value: money(productBeforeRounding + installation - productWithSurcharge - baseInstallation),
          },
          {
            label: 'До округления',
            formula: `${money(productBeforeRounding)} + ${money(installation)}`,
            value: money(productBeforeRounding + installation),
          },
          {
            label: 'Округление до сотни',
            formula: `ceil100(${money(productBeforeRounding + installation)})`,
            value: money(subtotal),
          },
          {
            label: 'Скидка',
            formula: form.discountEnabled
              ? `ceil100(${money(subtotal)} × (1 − ${number(appliedDiscount)}%))`
              : 'Не применяется',
            value: form.discountEnabled ? money(subtotal - total) : money(0),
          },
          {
            label: 'Итого за 1 шт.',
            formula: form.discountEnabled ? `${money(subtotal)} − ${money(subtotal - total)}` : money(subtotal),
            value: money(unitResult.total),
            emphasis: true,
          },
          {
            label: `Количество: ${normalizedQuantity}`,
            formula: `${money(unitResult.total)} × ${normalizedQuantity}`,
            value: money(unitResult.total * normalizedQuantity),
            emphasis: true,
          },
        ],
      },
    ],
  }
}

export const buildMirrorCalculationBreakdown = (
  catalog: MirrorPricingCatalog,
  form: MirrorForm,
  quantity: number,
  unitResult: CalculationResult,
): AdminCalculationBreakdown => {
  const area = mirrorArea(form)
  const material = getMirrorMaterial(catalog, form.materialId)
  const options = getMirrorCalculatedOptions(catalog, form).filter((item) => item.category === 'work')
  const valid = Object.keys(unitResult.errors).length === 0
  const rawMaterial = valid ? area * material.price : 0
  const rawWork = valid ? options.reduce((sum, item) => sum + item.total, 0) : 0
  const materialMarkup = Math.max(0, Number(catalog.settings.materialMarkupPercent) || 0)
  const serviceMarkup = Math.max(0, Number(catalog.settings.serviceMarkupPercent) || 0)
  const baseProduct = rawMaterial * percentFactor(materialMarkup)
  const baseInstallation = rawWork * percentFactor(serviceMarkup)
  const baseSubtotal = baseProduct + baseInstallation
  const managerPercent = form.managerEnabled ? Math.max(0, Number(catalog.settings.managerPercent) || 0) : 0
  const designerPercent = form.designerEnabled ? Math.max(0, Number(catalog.settings.designerPercent) || 0) : 0
  const manager = baseSubtotal * managerPercent / 100
  const designer = baseSubtotal * designerPercent / 100
  const commissionFactor = baseSubtotal > 0 ? (baseSubtotal + manager + designer) / baseSubtotal : 1
  const productBeforeRounding = roundToTen(baseProduct * commissionFactor)
  const installation = roundToTen(baseInstallation * commissionFactor)
  const subtotal = roundMoneyUp(productBeforeRounding + installation)
  const appliedDiscount = form.discountEnabled ? discountPercent(form.discountPercent) : 0
  const total = form.discountEnabled
    ? roundMoneyUp(subtotal * (1 - appliedDiscount / 100))
    : subtotal
  const normalizedQuantity = Math.max(1, Math.floor(Number(quantity) || 1))
  const workRows: AdminCalculationRow[] = options.map((item) => ({
    label: item.label,
    formula: `${number(item.quantity)} ${item.unitLabel} × ${money(item.unitPrice)}`,
    value: money(item.total),
  }))
  if (workRows.length === 0) {
    workRows.push({ label: 'Выбранные работы', formula: 'Работы не выбраны', value: money(0) })
  }
  workRows.push(
    {
      label: 'Работы всего',
      formula: options.length > 0 ? options.map((item) => money(item.total)).join(' + ') : '0',
      value: money(rawWork),
    },
    {
      label: 'Работы с наценкой',
      formula: `${money(rawWork)} × (1 + ${number(serviceMarkup)}%)`,
      value: money(baseInstallation),
      emphasis: true,
    },
  )

  return {
    title: `Зеркало ${number(form.width, 0)} × ${number(form.height, 0)} мм`,
    sections: [
      {
        title: 'Материал',
        rows: [
          {
            label: 'Площадь',
            formula: `${number(form.width, 0)} / 1000 × ${number(form.height, 0)} / 1000`,
            value: `${number(area)} м²`,
          },
          {
            label: material.label,
            formula: `${number(area)} м² × ${money(material.price)}/м²`,
            value: money(rawMaterial),
          },
          {
            label: 'Материал с наценкой',
            formula: `${money(rawMaterial)} × (1 + ${number(materialMarkup)}%)`,
            value: money(baseProduct),
            emphasis: true,
          },
        ],
      },
      {
        title: 'Работы',
        rows: workRows,
      },
      {
        title: 'Надбавки и итог позиции',
        rows: [
          {
            label: 'База для надбавок',
            formula: `${money(baseProduct)} + ${money(baseInstallation)}`,
            value: money(baseSubtotal),
          },
          {
            label: 'Менеджер',
            formula: form.managerEnabled
              ? `${money(baseSubtotal)} × ${number(managerPercent)}%`
              : 'Не применяется',
            value: money(manager),
          },
          {
            label: 'Дизайнер',
            formula: form.designerEnabled
              ? `${money(baseSubtotal)} × ${number(designerPercent)}%`
              : 'Не применяется',
            value: money(designer),
          },
          {
            label: 'Коэффициент надбавок',
            formula: baseSubtotal > 0
              ? `(${money(baseSubtotal)} + ${money(manager)} + ${money(designer)}) / ${money(baseSubtotal)}`
              : 'Нет базы для расчёта',
            value: `× ${number(commissionFactor)}`,
          },
          {
            label: 'Изделие после надбавок',
            formula: `round10(${money(baseProduct)} × ${number(commissionFactor)})`,
            value: money(productBeforeRounding),
          },
          {
            label: 'Работы после надбавок',
            formula: `round10(${money(baseInstallation)} × ${number(commissionFactor)})`,
            value: money(installation),
          },
          {
            label: 'Округление до сотни',
            formula: `ceil100(${money(productBeforeRounding)} + ${money(installation)})`,
            value: money(subtotal),
          },
          {
            label: 'Скидка',
            formula: form.discountEnabled
              ? `ceil100(${money(subtotal)} × (1 − ${number(appliedDiscount)}%))`
              : 'Не применяется',
            value: form.discountEnabled ? money(subtotal - total) : money(0),
          },
          {
            label: 'Итого за 1 шт.',
            formula: form.discountEnabled ? `${money(subtotal)} − ${money(subtotal - total)}` : money(subtotal),
            value: money(unitResult.total),
            emphasis: true,
          },
          {
            label: `Количество: ${normalizedQuantity}`,
            formula: `${money(unitResult.total)} × ${normalizedQuantity}`,
            value: money(unitResult.total * normalizedQuantity),
            emphasis: true,
          },
        ],
      },
    ],
  }
}

export const buildOrderCalculationSection = (
  items: OrderCalculationItem[],
  delivery: QuoteDelivery,
  catalog: PricingCatalog,
  deliveryPrice: number,
  orderTotal: number,
): AdminCalculationSection => {
  const itemsTotal = items.reduce((sum, item) => sum + item.total, 0)
  const basePrice = Math.max(0, Number(catalog.services.deliveryBase) || 0)
  const kmRate = Math.max(0, Number(catalog.services.deliveryKmRate) || 0)
  const deliveryFormula = !delivery.enabled
    ? 'Доставка не выбрана'
    : delivery.zone === 'outside'
      ? `ceil100(${money(basePrice)} + ${number(delivery.km)} км × ${money(kmRate)}/км)`
      : `ceil100(${money(basePrice)})`

  return {
    title: 'Общее КП',
    rows: [
      ...items.map((item) => ({
        label: item.label,
        formula: 'Итог позиции с учётом количества и скидки',
        value: money(item.total),
      })),
      {
        label: 'Все позиции',
        formula: items.length > 0 ? items.map((item) => money(item.total)).join(' + ') : '0',
        value: money(itemsTotal),
      },
      {
        label: delivery.zone === 'outside' && delivery.enabled ? 'Доставка за город' : 'Доставка',
        formula: deliveryFormula,
        value: money(deliveryPrice),
      },
      {
        label: 'Итого по КП',
        formula: `${money(itemsTotal)} + ${money(deliveryPrice)}`,
        value: money(orderTotal),
        emphasis: true,
      },
    ],
  }
}
