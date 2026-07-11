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
      imageUrl: 'https://dush.zm-tools.ru/upload/resize_cache/iblock/eec/150_150_0/dbqgvx00zl4yysqem07mnh9mg413p1jd.JPG',
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
      imageUrl: 'https://dush.zm-tools.ru/upload/resize_cache/iblock/7dd/150_150_0/69u4a3xqhnuaj19lpczu60hhrkn21gs1.JPG',
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
      imageUrl: 'https://dush.zm-tools.ru/upload/resize_cache/iblock/7b4/150_150_0/6nhimb66ap65b6a1uubx6gv1eu507yxv.JPG',
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
      imageUrl: 'https://dush.zm-tools.ru/upload/resize_cache/iblock/d02/150_150_0/mmj2mgqiq7hynak7obv7x4251ku432a6.JPG',
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
      imageUrl: 'https://dush.zm-tools.ru/upload/resize_cache/iblock/3db/u0seg5mzq8gya52kiymxx8dssrntfrtb/150_150_0/IMG_4868.jpg',
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
      imageUrl: 'https://dush.zm-tools.ru/upload/resize_cache/iblock/11b/150_150_0/12bxhv2qd49y7xsfp95w33tlxqraiypp.JPG',
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
      imageUrl: 'https://dush.zm-tools.ru/upload/resize_cache/iblock/768/150_150_0/gexnsxp0uw9e2otmm4hdlh1wkthrqfe5.JPG',
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
      imageUrl: 'https://dush.zm-tools.ru/upload/resize_cache/iblock/57a/150_150_0/gzmex37ovugojagqnzny0x4wvg5x8i8i.JPG',
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
      imageUrl: 'https://dush.zm-tools.ru/upload/resize_cache/iblock/e2f/150_150_0/gqgby9h0uez3cryltkun4xrl6zi69s7n.jpg',
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
      imageUrl: 'https://dush.zm-tools.ru/upload/resize_cache/iblock/10d/150_150_0/q69i8kgl2z8ym83wzbn8lcdprr1vg6ta.JPG',
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
      imageUrl: 'https://dush.zm-tools.ru/upload/resize_cache/iblock/f89/150_150_0/20yo38akrbm80prv9qs4r53oqx0x7qnv.JPG',
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
      imageUrl: 'https://dush.zm-tools.ru/upload/resize_cache/iblock/3ca/150_150_0/ztnqxr7crxmrfuvnfa2qcpwrrmcidlq6.JPG',
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
