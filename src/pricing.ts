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
  imageUrl: string
  sketch: 'single' | 'panel-door' | 'panel' | 'niche' | 'corner' | 'corner-plus' | 'double-corner' | 'slider' | 'slider-corner' | 'slider-double' | 'trapezoid'
  fields: DimensionField[]
}

export type PriceOption = {
  id: string
  label: string
  price: number
}

export type ServicePrices = {
  installation: number
  deliveryBase: number
  deliveryKmRate: number
  discountPercent: number
  heightSurchargeAfter: number
  heightSurchargePercent: number
}

export type PricingCatalog = {
  constructions: Construction[]
  glass: PriceOption[]
  hardware: PriceOption[]
  hardwareClass: PriceOption[]
  services: ServicePrices
}

export const defaultCatalog: PricingCatalog = {
  constructions: [
    {
      id: '6663',
      title: 'Шторка одинарная',
      shortTitle: 'Шторка',
      basePrice: 4000,
      imageUrl: shower6663,
      sketch: 'single',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина', min: 200, max: 2000, defaultValue: 900 },
      ],
    },
    {
      id: '6744',
      title: 'Шторка с добором (глухое + дверь)',
      shortTitle: 'Шторка + добор',
      basePrice: 8000,
      imageUrl: shower6744,
      sketch: 'panel-door',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина добора', min: 200, max: 1200, defaultValue: 500 },
        { key: 'WIDTH_1', label: 'Ширина двери', min: 200, max: 800, defaultValue: 700 },
      ],
    },
    {
      id: '6747',
      title: 'Перегородка',
      shortTitle: 'Перегородка',
      basePrice: 4000,
      imageUrl: shower6747,
      sketch: 'panel',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина', min: 200, max: 2500, defaultValue: 1000 },
      ],
    },
    {
      id: '6745',
      title: 'Дверка в нишу одинарная распашная',
      shortTitle: 'Дверка',
      basePrice: 4000,
      imageUrl: shower6745,
      sketch: 'niche',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина', min: 400, max: 1000, defaultValue: 800 },
      ],
    },
    {
      id: '6746',
      title: 'Дверка в нишу с добором (глухое + дверь)',
      shortTitle: 'Ниша + добор',
      basePrice: 8000,
      imageUrl: shower6746,
      sketch: 'panel-door',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина добора', min: 200, max: 1000, defaultValue: 500 },
        { key: 'WIDTH_1', label: 'Ширина двери', min: 400, max: 1000, defaultValue: 800 },
      ],
    },
    {
      id: '6748',
      title: 'Г-образная угловая (глухое + дверь)',
      shortTitle: 'Г-образная',
      basePrice: 8000,
      imageUrl: shower6748,
      sketch: 'corner',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина стенки', min: 200, max: 1200, defaultValue: 800 },
        { key: 'WIDTH_1', label: 'Ширина двери', min: 400, max: 1000, defaultValue: 750 },
      ],
    },
    {
      id: '6749',
      title: 'Г-образная угловая (глухое + дверь + добор)',
      shortTitle: 'Угол + добор',
      basePrice: 12000,
      imageUrl: shower6749,
      sketch: 'corner-plus',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина стенки', min: 200, max: 2000, defaultValue: 800 },
        { key: 'WIDTH_1', label: 'Ширина добора', min: 200, max: 1200, defaultValue: 450 },
        { key: 'WIDTH_2', label: 'Ширина двери', min: 400, max: 1000, defaultValue: 750 },
      ],
    },
    {
      id: '6750',
      title: 'Г-образная угловая распашная (2 глухих + 2 двери)',
      shortTitle: 'Угол 4 стекла',
      basePrice: 16000,
      imageUrl: shower6750,
      sketch: 'double-corner',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Левый добор', min: 200, max: 1000, defaultValue: 450 },
        { key: 'WIDTH_1', label: 'Левая дверь', min: 400, max: 1000, defaultValue: 700 },
        { key: 'WIDTH_2', label: 'Правый добор', min: 200, max: 1000, defaultValue: 450 },
        { key: 'WIDTH_3', label: 'Правая дверь', min: 400, max: 1000, defaultValue: 700 },
      ],
    },
    {
      id: '6751',
      title: 'Раздвижка прямая (2 стекла)',
      shortTitle: 'Раздвижка',
      basePrice: 8000,
      imageUrl: shower6751,
      sketch: 'slider',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Ширина стенки', min: 200, max: 1000, defaultValue: 700 },
        { key: 'WIDTH_1', label: 'Ширина двери', min: 300, max: 1000, defaultValue: 800 },
      ],
    },
    {
      id: '6752',
      title: 'Раздвижка угловая (3 стекла, одна дверка)',
      shortTitle: 'Угл. раздвижка',
      basePrice: 12000,
      imageUrl: shower6752,
      sketch: 'slider-corner',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Сторона двери', min: 200, max: 1000, defaultValue: 650 },
        { key: 'WIDTH_1', label: 'Ширина двери', min: 300, max: 1000, defaultValue: 800 },
        { key: 'WIDTH_2', label: 'Ширина стенки', min: 200, max: 2000, defaultValue: 900 },
      ],
    },
    {
      id: '6753',
      title: 'Раздвижка угловая (4 стекла, две дверки)',
      shortTitle: 'Раздвижка 4',
      basePrice: 16000,
      imageUrl: shower6753,
      sketch: 'slider-double',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Левая стенка', min: 200, max: 1000, defaultValue: 650 },
        { key: 'WIDTH_1', label: 'Левая дверь', min: 300, max: 1000, defaultValue: 750 },
        { key: 'WIDTH_2', label: 'Правая стенка', min: 200, max: 1000, defaultValue: 650 },
        { key: 'WIDTH_3', label: 'Правая дверь', min: 300, max: 1000, defaultValue: 750 },
      ],
    },
    {
      id: '6754',
      title: 'Трапеция (3 стекла)',
      shortTitle: 'Трапеция',
      basePrice: 12000,
      imageUrl: shower6754,
      sketch: 'trapezoid',
      fields: [
        { key: 'HEIGHT_0', label: 'Высота', min: 1000, max: 2500, defaultValue: 2000, surchargeAfter: 2200 },
        { key: 'WIDTH_0', label: 'Левая стенка', min: 200, max: 1000, defaultValue: 650 },
        { key: 'WIDTH_1', label: 'Ширина двери', min: 400, max: 1000, defaultValue: 800 },
        { key: 'WIDTH_2', label: 'Правая стенка', min: 200, max: 1000, defaultValue: 650 },
      ],
    },
  ],
  glass: [
    { id: 'clear', label: 'Бесцветное', price: 6200 },
    { id: 'matte', label: 'Матовое', price: 11400 },
    { id: 'tinted', label: 'Тонированное', price: 11500 },
    { id: 'optiwhite', label: 'Осветленное', price: 13600 },
  ],
  hardware: [
    { id: 'chrome', label: 'Глянцевый хром', price: 100 },
    { id: 'mattchrome', label: 'Матовый хром', price: 100 },
    { id: 'black', label: 'Черный', price: 120 },
    { id: 'bronze', label: 'Бронза', price: 135 },
    { id: 'gold', label: 'Золото', price: 140 },
  ],
  hardwareClass: [
    { id: 'standard', label: 'Стандарт', price: 3700 },
    { id: 'premium', label: 'Премиум', price: 9600 },
  ],
  services: {
    installation: 5000,
    deliveryBase: 4000,
    deliveryKmRate: 70,
    discountPercent: 5,
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
