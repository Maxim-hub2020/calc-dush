export type DimensionField = {
  key: string
  label: string
  min: number
  max: number
  defaultValue: number
  surchargeAfter?: number
}

export type Construction = {
  id: string
  title: string
  shortTitle: string
  basePrice: number
  installationPrice: number
  imageUrl: string
  sketch: 'single' | 'panel-door' | 'panel' | 'niche' | 'corner' | 'corner-plus' | 'double-corner' | 'slider' | 'slider-corner' | 'slider-double' | 'trapezoid'
  fields: DimensionField[]
  hardwareComponents?: ConstructionHardwareComponent[]
}

export type PriceOption = {
  id: string
  label: string
  price: number
  thickness?: 6 | 8
}

export type ShowerHardwareItem = PriceOption & {
  sectionId: ShowerHardwareSectionId
  sku?: string
  sourceUrl?: string
  sourceProductId?: string
  priceOnRequest?: boolean
}

export type ConstructionHardwareComponent = {
  id: string
  hardwareItemId: string
  quantity: number
  glassThickness?: 6 | 8
}

export type ServicePrices = {
  deliveryBase: number
  deliveryKmRate: number
  productMarkupPercent: number
  hardwareMarkupPercent: number
  discountPercent: number
  designerPercent: number
  heightSurchargeAfter: number
  heightSurchargePercent: number
}

export type PricingCatalog = {
  revision: number
  constructions: Construction[]
  glass: PriceOption[]
  hardware: PriceOption[]
  hardwareItems: ShowerHardwareItem[]
  hardwareClass: PriceOption[]
  services: ServicePrices
}

const hardwareComponent = (
  id: string,
  hardwareItemId: string,
  quantity: number,
  glassThickness?: 6 | 8,
): ConstructionHardwareComponent => ({
  id,
  hardwareItemId: legacyShowerHardwareIdMap[hardwareItemId] ?? hardwareItemId,
  quantity,
  glassThickness,
})

const thicknessComponents = (
  prefix: string,
  hardwareItem6Id: string,
  hardwareItem8Id: string,
  quantity = 1,
) => [
  hardwareComponent(`${prefix}-6`, hardwareItem6Id, quantity, 6),
  hardwareComponent(`${prefix}-8`, hardwareItem8Id, quantity, 8),
]

export const defaultCatalog: PricingCatalog = {
  revision: 5,
  constructions: [
    {
      id: '6663',
      title: 'Шторка одинарная',
      shortTitle: 'Шторка',
      basePrice: 0,
      installationPrice: 5000,
      imageUrl: shower6663,
      sketch: 'single',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина', min: 200, max: 2000, defaultValue: 900 },
      ],
      hardwareComponents: [
        hardwareComponent('6663-wall-connector', 'av24-fdk22', 3),
        hardwareComponent('6663-tube', 'av24-fdt151', 1),
        hardwareComponent('6663-wall-mount', 'av24-fdc14', 1),
        hardwareComponent('6663-glass-holder', 'av24-fdc12', 1),
      ],
    },
    {
      id: '6744',
      title: 'Шторка с добором (глухое + дверь)',
      shortTitle: 'Шторка + добор',
      basePrice: 0,
      installationPrice: 5000,
      imageUrl: shower6744,
      sketch: 'panel-door',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина добора', min: 200, max: 1200, defaultValue: 500 },
        { key: 'WIDTH_1', label: 'Ширина двери', min: 200, max: 800, defaultValue: 700 },
      ],
      hardwareComponents: [
        hardwareComponent('6744-glass-hinge', 'av24-fdp115', 2),
        hardwareComponent('6744-wall-connector', 'av24-fdk22', 4),
        hardwareComponent('6744-knob', 'av24-fdr30', 1),
        hardwareComponent('6744-tube', 'av24-fdt151', 1),
        hardwareComponent('6744-wall-mount', 'av24-fdc14', 1),
        hardwareComponent('6744-glass-holder', 'av24-fdc12', 1),
        hardwareComponent('6744-threshold', 'av24-threshold', 1),
        ...thicknessComponents('6744-bottom-seal', 'av24-bottom-seal-6', 'av24-bottom-seal-8'),
        ...thicknessComponents('6744-side-seal', 'av24-chi-seal-6', 'av24-chi-seal-8'),
        ...thicknessComponents('6744-magnetic-seal', 'av24-magnetic-180-6', 'av24-magnetic-180-8'),
      ],
    },
    {
      id: '6747',
      title: 'Перегородка',
      shortTitle: 'Перегородка',
      basePrice: 0,
      installationPrice: 5000,
      imageUrl: shower6747,
      sketch: 'panel',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина', min: 200, max: 2500, defaultValue: 1000 },
      ],
      hardwareComponents: [
        hardwareComponent('6747-wall-connector', 'av24-fdk22', 3),
        hardwareComponent('6747-tube', 'av24-fdt151', 1),
        hardwareComponent('6747-wall-mount', 'av24-fdc14', 1),
        hardwareComponent('6747-glass-holder', 'av24-fdc12', 1),
      ],
    },
    {
      id: '6745',
      title: 'Дверка в нишу одинарная распашная',
      shortTitle: 'Дверка',
      basePrice: 0,
      installationPrice: 5000,
      imageUrl: shower6745,
      sketch: 'niche',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина', min: 400, max: 1000, defaultValue: 800 },
      ],
      hardwareComponents: [
        hardwareComponent('6745-wall-hinge', 'av24-fdp122', 2),
        hardwareComponent('6745-knob', 'av24-fdr30', 1),
        hardwareComponent('6745-threshold', 'av24-threshold', 1),
        ...thicknessComponents('6745-bottom-seal', 'av24-bottom-seal-6', 'av24-bottom-seal-8'),
        ...thicknessComponents('6745-side-seal', 'av24-chi-seal-6', 'av24-chi-seal-8'),
        ...thicknessComponents('6745-magnetic-seal', 'av24-magnetic-90-6', 'av24-magnetic-90-8'),
      ],
    },
    {
      id: '6746',
      title: 'Дверка в нишу с добором (глухое + дверь)',
      shortTitle: 'Ниша + добор',
      basePrice: 0,
      installationPrice: 5000,
      imageUrl: shower6746,
      sketch: 'panel-door',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина добора', min: 200, max: 1000, defaultValue: 500 },
        { key: 'WIDTH_1', label: 'Ширина двери', min: 400, max: 1000, defaultValue: 800 },
      ],
      hardwareComponents: [
        hardwareComponent('6746-glass-hinge', 'av24-fdp115', 2),
        hardwareComponent('6746-wall-connector', 'av24-fdk22', 4),
        hardwareComponent('6746-knob', 'av24-fdr30', 1),
        hardwareComponent('6746-tube', 'av24-fdt151', 1),
        hardwareComponent('6746-wall-mount', 'av24-fdc14', 1),
        hardwareComponent('6746-glass-holder', 'av24-fdc12', 1),
        hardwareComponent('6746-threshold', 'av24-threshold', 1),
        ...thicknessComponents('6746-bottom-seal', 'av24-bottom-seal-6', 'av24-bottom-seal-8'),
        ...thicknessComponents('6746-side-seal', 'av24-chi-seal-6', 'av24-chi-seal-8'),
        ...thicknessComponents('6746-magnetic-seal', 'av24-magnetic-90-6', 'av24-magnetic-90-8'),
      ],
    },
    {
      id: '6748',
      title: 'Г-образная угловая (глухое + дверь)',
      shortTitle: 'Г-образная',
      basePrice: 0,
      installationPrice: 5000,
      imageUrl: shower6748,
      sketch: 'corner',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина стенки', min: 200, max: 1200, defaultValue: 800 },
        { key: 'WIDTH_1', label: 'Ширина двери', min: 400, max: 1000, defaultValue: 750 },
      ],
      hardwareComponents: [
        hardwareComponent('6748-wall-hinge', 'av24-fdp122', 2),
        hardwareComponent('6748-wall-connector', 'av24-fdk22', 4),
        hardwareComponent('6748-corner-connector', 'av24-fdk24', 2),
        hardwareComponent('6748-knob', 'av24-fdr30', 1),
        hardwareComponent('6748-tube', 'av24-fdt151', 1),
        hardwareComponent('6748-wall-mount', 'av24-fdc14', 1),
        hardwareComponent('6748-glass-holder', 'av24-fdc12', 1),
        hardwareComponent('6748-threshold', 'av24-threshold', 1),
        ...thicknessComponents('6748-bottom-seal', 'av24-bottom-seal-6', 'av24-bottom-seal-8'),
        ...thicknessComponents('6748-side-seal', 'av24-chi-seal-6', 'av24-chi-seal-8'),
        ...thicknessComponents('6748-magnetic-seal', 'av24-magnetic-90-6', 'av24-magnetic-90-8'),
      ],
    },
    {
      id: '6749',
      title: 'Г-образная угловая (глухое + дверь + добор)',
      shortTitle: 'Угол + добор',
      basePrice: 0,
      installationPrice: 5000,
      imageUrl: shower6749,
      sketch: 'corner-plus',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина стенки', min: 200, max: 2000, defaultValue: 800 },
        { key: 'WIDTH_1', label: 'Ширина добора', min: 200, max: 1200, defaultValue: 450 },
        { key: 'WIDTH_2', label: 'Ширина двери', min: 400, max: 1000, defaultValue: 750 },
      ],
      hardwareComponents: [
        hardwareComponent('6749-glass-hinge', 'av24-fdp115', 2),
        hardwareComponent('6749-wall-connector', 'av24-fdk22', 5),
        hardwareComponent('6749-corner-connector', 'av24-fdk24', 2),
        hardwareComponent('6749-knob', 'av24-fdr30', 1),
        hardwareComponent('6749-tube', 'av24-fdt151', 1),
        hardwareComponent('6749-wall-mount', 'av24-fdc14', 1),
        hardwareComponent('6749-glass-holder', 'av24-fdc12', 2),
        hardwareComponent('6749-threshold', 'av24-threshold', 1),
        ...thicknessComponents('6749-bottom-seal', 'av24-bottom-seal-6', 'av24-bottom-seal-8'),
        ...thicknessComponents('6749-side-seal', 'av24-chi-seal-6', 'av24-chi-seal-8'),
        ...thicknessComponents('6749-magnetic-seal', 'av24-magnetic-90-6', 'av24-magnetic-90-8'),
      ],
    },
    {
      id: '6750',
      title: 'Г-образная угловая распашная (2 глухих + 2 двери)',
      shortTitle: 'Угол 4 стекла',
      basePrice: 0,
      installationPrice: 5000,
      imageUrl: shower6750,
      sketch: 'double-corner',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Левый добор', min: 200, max: 1000, defaultValue: 450 },
        { key: 'WIDTH_1', label: 'Левая дверь', min: 400, max: 1000, defaultValue: 700 },
        { key: 'WIDTH_2', label: 'Правый добор', min: 200, max: 1000, defaultValue: 450 },
        { key: 'WIDTH_3', label: 'Правая дверь', min: 400, max: 1000, defaultValue: 700 },
      ],
      hardwareComponents: [
        hardwareComponent('6750-corner-hinge', 'av24-fdp184', 4),
        hardwareComponent('6750-wall-connector', 'av24-fdk22', 4),
        hardwareComponent('6750-corner-connector', 'av24-fdk24', 2),
        hardwareComponent('6750-knob', 'av24-fdr30', 2),
        hardwareComponent('6750-tube', 'av24-fdt151', 1),
        hardwareComponent('6750-wall-mount', 'av24-fdc14', 2),
        hardwareComponent('6750-glass-holder', 'av24-fdc12', 2),
        hardwareComponent('6750-threshold', 'av24-threshold', 1),
        ...thicknessComponents('6750-bottom-seal', 'av24-bottom-seal-6', 'av24-bottom-seal-8', 2),
        ...thicknessComponents('6750-side-seal', 'av24-chi-seal-6', 'av24-chi-seal-8', 2),
        ...thicknessComponents('6750-magnetic-seal', 'av24-magnetic-90-6', 'av24-magnetic-90-8'),
      ],
    },
    {
      id: '6751',
      title: 'Раздвижка прямая (2 стекла)',
      shortTitle: 'Раздвижка',
      basePrice: 0,
      installationPrice: 5000,
      imageUrl: shower6751,
      sketch: 'slider',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина стенки', min: 200, max: 1000, defaultValue: 700 },
        { key: 'WIDTH_1', label: 'Ширина двери', min: 300, max: 1000, defaultValue: 800 },
      ],
      hardwareComponents: [
        hardwareComponent('6751-slider', 'av24-fds1', 1),
        hardwareComponent('6751-track', 'av24-fdt352', 1),
        hardwareComponent('6751-track-wall', 'av24-fdc30', 1),
        hardwareComponent('6751-track-glass', 'av24-fdc33', 1),
        ...thicknessComponents('6751-f-seal', 'av24-f-seal-6', 'av24-f-seal-8'),
      ],
    },
    {
      id: '6752',
      title: 'Раздвижка угловая (3 стекла, одна дверка)',
      shortTitle: 'Угл. раздвижка',
      basePrice: 0,
      installationPrice: 5000,
      imageUrl: shower6752,
      sketch: 'slider-corner',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Сторона двери', min: 200, max: 1000, defaultValue: 650 },
        { key: 'WIDTH_1', label: 'Ширина двери', min: 300, max: 1000, defaultValue: 800 },
        { key: 'WIDTH_2', label: 'Ширина стенки', min: 200, max: 2000, defaultValue: 900 },
      ],
      hardwareComponents: [
        hardwareComponent('6752-slider', 'av24-fds1', 1),
        hardwareComponent('6752-track', 'av24-fdt352', 1),
        hardwareComponent('6752-track-wall', 'av24-fdc30', 1),
        hardwareComponent('6752-track-terminal', 'av24-fdc33', 1),
        hardwareComponent('6752-track-through', 'av24-fdc35', 1),
        hardwareComponent('6752-wall-connector', 'av24-fdk22', 4),
        hardwareComponent('6752-corner-connector', 'av24-fdk24', 2),
        ...thicknessComponents('6752-f-seal', 'av24-f-seal-6', 'av24-f-seal-8'),
        ...thicknessComponents('6752-magnetic-seal', 'av24-magnetic-90-6', 'av24-magnetic-90-8'),
      ],
    },
    {
      id: '6753',
      title: 'Раздвижка угловая (4 стекла, две дверки)',
      shortTitle: 'Раздвижка 4',
      basePrice: 0,
      installationPrice: 5000,
      imageUrl: shower6753,
      sketch: 'slider-double',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Левая стенка', min: 200, max: 1000, defaultValue: 650 },
        { key: 'WIDTH_1', label: 'Левая дверь', min: 300, max: 1000, defaultValue: 750 },
        { key: 'WIDTH_2', label: 'Правая стенка', min: 200, max: 1000, defaultValue: 650 },
        { key: 'WIDTH_3', label: 'Правая дверь', min: 300, max: 1000, defaultValue: 750 },
      ],
      hardwareComponents: [
        hardwareComponent('6753-slider', 'av24-fds1', 2),
        hardwareComponent('6753-track', 'av24-fdt352', 2),
        hardwareComponent('6753-track-wall', 'av24-fdc30', 2),
        hardwareComponent('6753-track-terminal', 'av24-fdc33', 2),
        hardwareComponent('6753-track-through', 'av24-fdc35', 2),
        hardwareComponent('6753-wall-connector', 'av24-fdk22', 4),
        hardwareComponent('6753-corner-connector', 'av24-fdk24', 2),
        ...thicknessComponents('6753-f-seal', 'av24-f-seal-6', 'av24-f-seal-8', 2),
        ...thicknessComponents('6753-magnetic-seal', 'av24-magnetic-90-6', 'av24-magnetic-90-8'),
      ],
    },
    {
      id: '6754',
      title: 'Трапеция (3 стекла)',
      shortTitle: 'Трапеция',
      basePrice: 0,
      installationPrice: 5000,
      imageUrl: shower6754,
      sketch: 'trapezoid',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Левая стенка', min: 200, max: 1000, defaultValue: 650 },
        { key: 'WIDTH_1', label: 'Ширина двери', min: 400, max: 1000, defaultValue: 800 },
        { key: 'WIDTH_2', label: 'Правая стенка', min: 200, max: 1000, defaultValue: 650 },
      ],
      hardwareComponents: [
        hardwareComponent('6754-glass-hinge', 'av24-fdp115', 2),
        hardwareComponent('6754-wall-connector', 'av24-fdk22', 4),
        hardwareComponent('6754-wall-135', 'av24-fdk27', 2),
        hardwareComponent('6754-glass-135', 'av24-fdk28', 4),
        hardwareComponent('6754-knob', 'av24-fdr30', 1),
        hardwareComponent('6754-tube', 'av24-fdt151', 1),
        hardwareComponent('6754-wall-mount', 'av24-fdc14', 2),
        hardwareComponent('6754-glass-holder', 'av24-fdc12', 2),
        hardwareComponent('6754-threshold', 'av24-threshold', 1),
        ...thicknessComponents('6754-bottom-seal', 'av24-bottom-seal-6', 'av24-bottom-seal-8'),
        ...thicknessComponents('6754-side-seal', 'av24-chi-seal-6', 'av24-chi-seal-8'),
        ...thicknessComponents('6754-magnetic-seal', 'av24-magnetic-135-6', 'av24-magnetic-135-8'),
      ],
    },
  ],
  glass: [
    { id: 'clear', label: 'Бесцветное M1, 8 мм', price: 3060, thickness: 8 },
    { id: 'matte', label: 'Бесцветное матовое (сатин), 8 мм', price: 4150, thickness: 8 },
    { id: 'tinted', label: 'Бронза в массе, 8 мм', price: 4400, thickness: 8 },
    { id: 'optiwhite', label: 'Larta Ultra Clear, 8 мм', price: 4600, thickness: 8 },
    { id: 'cristallvision-8', label: 'CristallVision, 8 мм', price: 5740, thickness: 8 },
    { id: 'salavat-8', label: 'Осветленное Салават, 8 мм', price: 5050, thickness: 8 },
    { id: 'cristallvision-matte-8', label: 'CristallVision матовое, 8 мм', price: 6500, thickness: 8 },
    { id: 'bronze-matte-8', label: 'Бронза матовая в массе, 8 мм', price: 6040, thickness: 8 },
    { id: 'grey-8', label: 'Серое в массе, 8 мм', price: 4400, thickness: 8 },
    { id: 'dark-grey-8', label: 'Dark grey в массе, 8 мм', price: 9000, thickness: 8 },
    { id: 'moru-clear-8', label: 'Moru осветленное рифленое, 8 мм', price: 10350, thickness: 8 },
    { id: 'moru-bronze-8', label: 'Moru бронза рифленое, 8 мм', price: 10860, thickness: 8 },
    { id: 'moru-grey-8', label: 'Moru серое рифленое, 8 мм', price: 10860, thickness: 8 },
    { id: 'rainbow-clear-8', label: 'Rainbow осветленное рифленое, 8 мм', price: 11870, thickness: 8 },
    { id: 'clear-6', label: 'Бесцветное M1, 6 мм', price: 2150, thickness: 6 },
    { id: 'matte-6', label: 'Бесцветное матовое (сатин), 6 мм', price: 3410, thickness: 6 },
    { id: 'cristallvision-6', label: 'CristallVision, 6 мм', price: 4410, thickness: 6 },
    { id: 'larta-ultra-clear-6', label: 'Larta Ultra Clear, 6 мм', price: 3000, thickness: 6 },
    { id: 'bronze-6', label: 'Бронза в массе, 6 мм', price: 3150, thickness: 6 },
    { id: 'grey-6', label: 'Серое в массе, 6 мм', price: 3150, thickness: 6 },
    { id: 'stopsol-grey-6', label: 'Stopsol Phoenix Grey, 6 мм', price: 4900, thickness: 6 },
    { id: 'stopsol-bronze-6', label: 'Stopsol Phoenix Bronze, 6 мм', price: 4910, thickness: 6 },
    { id: 'stopsol-clear-6', label: 'Stopsol Phoenix Clear, 6 мм', price: 3550, thickness: 6 },
  ],
  hardware: [
    { id: 'chrome', label: 'Глянцевый хром', price: 0 },
    { id: 'black', label: 'Черный матовый', price: 5 },
    { id: 'mattchrome', label: 'Матовый хром', price: 25 },
    { id: 'bronze', label: 'Бронза', price: 25 },
    { id: 'gunmetal', label: 'Оружейная сталь', price: 60 },
    { id: 'gold', label: 'Золото / брашированное золото', price: 55 },
  ],
  hardwareItems: av24ShowerHardwareItems,
  hardwareClass: [
    { id: 'standard', label: 'Стандарт', price: 0 },
    { id: 'premium', label: 'Премиум', price: 100 },
  ],
  services: {
    deliveryBase: 1500,
    deliveryKmRate: 50,
    productMarkupPercent: 0,
    hardwareMarkupPercent: 0,
    discountPercent: 5,
    designerPercent: 10,
    heightSurchargeAfter: 2200,
    heightSurchargePercent: 30,
  },
}

export const createDefaultDimensions = (construction: Construction) =>
  construction.fields.reduce<Record<string, number>>((acc, field) => {
    acc[field.key] = field.defaultValue
    return acc
  }, {})
import shower6663 from './assets/showers/shower-6663.webp'
import shower6744 from './assets/showers/shower-6744.webp'
import shower6745 from './assets/showers/shower-6745.webp'
import shower6746 from './assets/showers/shower-6746.webp'
import shower6747 from './assets/showers/shower-6747.webp'
import shower6748 from './assets/showers/shower-6748.webp'
import shower6749 from './assets/showers/shower-6749.webp'
import shower6750 from './assets/showers/shower-6750.webp'
import shower6751 from './assets/showers/shower-6751.webp'
import shower6752 from './assets/showers/shower-6752.webp'
import shower6753 from './assets/showers/shower-6753.webp'
import shower6754 from './assets/showers/shower-6754.webp'
import {
  av24ShowerHardwareItems,
  legacyShowerHardwareIdMap,
  type ShowerHardwareSectionId,
} from './showerAv24Components'
