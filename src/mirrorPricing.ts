import { vdsMirrorComponents } from './mirrorVdsComponents'

export type MirrorUnit = 'piece' | 'area' | 'perimeter'

export type MirrorServiceSectionId =
  | 'works'
  | 'switches'
  | 'power'
  | 'led-tape'
  | 'heating'
  | 'electrical'
  | 'profiles'
  | 'mounting'
  | 'consumables'
  | 'glass-processing'

export type MirrorServiceSection = {
  id: MirrorServiceSectionId
  label: string
}

export type MirrorMaterial = {
  id: string
  label: string
  price: number
}

export type MirrorService = {
  id: string
  label: string
  price: number
  unit: MirrorUnit
  category: 'work' | 'delivery'
  sectionId: MirrorServiceSectionId
  visibleInQuote: boolean
  sku?: string
  sourceUrl?: string
}

export type MirrorServiceGroupItem = {
  id: string
  serviceId: string
  quantity: number
}

export type MirrorServiceGroup = {
  id: string
  label: string
  items: MirrorServiceGroupItem[]
  visibleInQuote: boolean
}

export type MirrorPricingSettings = {
  materialMarkupPercent: number
  serviceMarkupPercent: number
  managerPercent: number
  designerPercent: number
  discountPercent: number
}

export type MirrorPricingCatalog = {
  revision: number
  materials: MirrorMaterial[]
  services: MirrorService[]
  groups: MirrorServiceGroup[]
  settings: MirrorPricingSettings
}

const material = (id: string, label: string, price: number): MirrorMaterial => ({ id, label, price })
const service = (
  id: string,
  label: string,
  price: number,
  unit: MirrorUnit,
  visibleInQuote: boolean,
  category: MirrorService['category'] = 'work',
  sectionId: MirrorServiceSectionId = 'works',
): MirrorService => ({ id, label, price, unit, category, sectionId, visibleInQuote })

export const mirrorServiceSections: MirrorServiceSection[] = [
  { id: 'works', label: 'Работы и монтаж' },
  { id: 'switches', label: 'Выключатели и управление' },
  { id: 'power', label: 'Источники питания' },
  { id: 'led-tape', label: 'Светодиодные ленты' },
  { id: 'heating', label: 'Обогрев зеркал' },
  { id: 'electrical', label: 'Электрика и соединители' },
  { id: 'profiles', label: 'Профили и каркас' },
  { id: 'mounting', label: 'Крепление и навеска' },
  { id: 'consumables', label: 'Клей, скотч и расходники' },
  { id: 'glass-processing', label: 'Обработка стекла и зеркала' },
]

export const mirrorUnitLabels: Record<MirrorUnit, string> = {
  piece: 'шт.',
  area: 'м²',
  perimeter: 'м.п.',
}

export const defaultMirrorCatalog: MirrorPricingCatalog = {
  revision: 3,
  materials: [
    material('glass-4', 'Бесцветное M1, 4 мм', 930),
    material('glass-5', 'Бесцветное M1, 5 мм', 1340),
    material('glass-6', 'Бесцветное M1, 6 мм', 1310),
    material('glass-8', 'Бесцветное M1, 8 мм', 1870),
    material('glass-10', 'Бесцветное M1, 10 мм', 2210),
    material('glass-12', 'Бесцветное M1, 12 мм', 3500),
    material('matelux-white-4', 'Бесцветное матовое (сатин), 4 мм', 1750),
    material('matelux-white-6', 'Бесцветное матовое (сатин), 6 мм', 2570),
    material('matelux-white-8', 'Бесцветное матовое (сатин), 8 мм', 2960),
    material('matelux-white-10', 'Бесцветное матовое (сатин), 10 мм', 3860),
    material('clearvision-4', 'Осветлённое CristallVision, 4 мм', 2360),
    material('clearvision-6', 'Осветлённое CristallVision, 6 мм', 3570),
    material('clearvision-8', 'Осветлённое CristallVision, 8 мм', 4550),
    material('clearvision-10', 'Осветлённое CristallVision, 10 мм', 6310),
    material('salavat-5', 'Осветлённое Салават, 5 мм', 2660),
    material('salavat-8', 'Осветлённое Салават, 8 мм', 3860),
    material('larta-ultra-clear-6', 'Осветлённое Larta Ultra Clear, 6 мм', 2160),
    material('larta-ultra-clear-8', 'Осветлённое Larta Ultra Clear, 8 мм', 3410),
    material('clearvision-matt-4', 'Осветлённое матовое CristallVision (сатин), 4 мм', 2300),
    material('clearvision-matt-8', 'Осветлённое матовое CristallVision (сатин), 8 мм', 5310),
    material('clearvision-matt-10', 'Осветлённое матовое CristallVision (сатин), 10 мм', 7470),
    material('bronze-4', 'Бронза, тонированное в массе, 4 мм', 1470),
    material('bronze-6', 'Бронза, тонированное в массе, 6 мм', 2310),
    material('bronze-8', 'Бронза, тонированное в массе, 8 мм', 3210),
    material('bronze-10', 'Бронза, тонированное в массе, 10 мм', 4010),
    material('matelux-bronze-4', 'Бронза матовая, тонированное в массе, 4 мм', 2320),
    material('matelux-bronze-8', 'Бронза матовая, тонированное в массе, 8 мм', 4850),
    material('grey-4', 'Серое, тонированное в массе, 4 мм', 1470),
    material('grey-6', 'Серое, тонированное в массе, 6 мм', 2310),
    material('grey-8', 'Серое, тонированное в массе, 8 мм', 3210),
    material('grey-10', 'Серое, тонированное в массе, 10 мм', 4010),
    material('dark-grey-8', 'Dark grey, тонированное в массе, 8 мм', 7810),
    material('neutral-67-10', 'Neutral 67 SG HD с напылением, 10 мм', 4460),
    material('stopsol-grey-6', 'Stopsol Phoenix Grey, 6 мм', 4060),
    material('stopsol-bronze-6', 'Stopsol Phoenix Bronze, 6 мм', 4070),
    material('stopsol-clear-6', 'Stopsol Phoenix Clear, 6 мм', 2710),
    material('moru-clear-4', 'Moru осветлённое рифлёное, 4 мм', 3810),
    material('moru-clear-8', 'Moru осветлённое рифлёное, 8 мм', 9160),
    material('moru-bronze-8', 'Moru бронза, тонированное в массе, 8 мм', 9670),
    material('moru-grey-8', 'Moru серое, тонированное в массе, 8 мм', 9670),
    material('rainbow-clear-8', 'Rainbow осветлённое рифлёное, 8 мм', 10680),
    material('vision-sun-clear-4', 'Vision Sun осветлённое рифлёное, 4 мм', 4920),
    material('mirror-silver-4', 'Зеркало серебро, 4 мм', 1330),
    material('mirror-silver-6', 'Зеркало серебро, 6 мм', 2040),
    material('mirror-clear-4', 'Зеркало осветлённое, 4 мм', 2490),
    material('mirror-clear-6', 'Зеркало осветлённое, 6 мм', 4360),
    material('mirror-bronze-4', 'Зеркало бронза, 4 мм', 1970),
    material('mirror-graphite-4', 'Зеркало серое, 4 мм', 1970),
    material('mirror-aged-a1-4', 'Зеркало состаренное A1, 4 мм', 9300),
    material('mirror-aged-k1-4', 'Зеркало состаренное K1, 4 мм', 9310),
    material('lacobel-clear-white-4', 'Лакобель белый на осветлённом стекле, 4 мм', 3280),
    material('lacobel-basic-4', 'Лакобель чёрный, 4 мм', 2650),
    material('lacobel-peach-clear-4', 'Лакобель персик на осветлённом стекле, 4 мм', 3590),
    material('pure-comfort-10-4', 'Pure Comfort 10 (AGC), 4 мм', 1870),
  ],
  services: [
    service('installation-glue', 'Монтаж: приклейка', 2200, 'area', true),
    service('installation-hanging', 'Монтаж: навеска', 3000, 'piece', true),
    service('dismantling', 'Демонтаж', 3000, 'piece', true),
    service('backlight-background', 'Фоновая подсветка', 2200, 'perimeter', true),
    service('backlight-front', 'Лицевая подсветка', 2300, 'perimeter', true),
    service('installation-panel-glue', 'Монтаж: приклейка панно', 2000, 'area', true),
    service('cnc-cut', 'Вырез ЧПУ', 1500, 'piece', true),
    service('complexity', 'Сложность', 1000, 'piece', false),
    service('floor-lift', 'Подъём на этаж', 300, 'piece', true),
    service('heating-material', 'Материал подогрева', 1500, 'piece', true),
    service('touch-switch', 'Выключатель сенсорный', 1500, 'piece', true),
    service('installation-hanging-multiple', 'Навеска от 2 шт.', 2000, 'piece', true),
    service('clock', 'Часы', 4000, 'piece', true),
    service('hole', 'Отверстие', 400, 'piece', true),
    service('brass-frame', 'Рама латунь', 1000, 'piece', true),
    service('plywood-backing-10', 'Подложка фанера 10 мм', 700, 'area', true),
    service('shower-installation', 'Монтаж душевой', 10000, 'piece', true),
    service('shower-panel-installation', 'Монтаж душевой: глухарь', 5000, 'piece', true),
    service('shower-hinge', 'Петля душевая', 5000, 'piece', false),
    service('shower-support-profile', 'Душевой опорный профиль', 1500, 'piece', false),
    service('shower-glass-holder', 'Держатель стекла душевой', 1000, 'piece', false),
    service('shower-track', 'Трек 30×10, 2 м', 2400, 'piece', false),
    service('shower-pipe-wall-mount', 'Крепление трубы к стене', 600, 'piece', false),
    service('shower-magnetic-seal', 'Магнитный уплотнитель', 1100, 'piece', false),
    service('aluminium-frame', 'Рамка алюминиевая', 2200, 'perimeter', true),
    service('mdf-frame', 'Рама МДФ', 5000, 'perimeter', true),
    service('yugros-edge-straight-4', 'Прямолинейная полировка / шлифовка, 4 мм', 82, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-edge-straight-5', 'Прямолинейная полировка / шлифовка, 5 мм', 82, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-edge-straight-6', 'Прямолинейная полировка / шлифовка, 6 мм', 118, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-edge-straight-8', 'Прямолинейная полировка / шлифовка, 8 мм', 154, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-edge-straight-10', 'Прямолинейная полировка / шлифовка, 10 мм', 190, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-edge-straight-12', 'Прямолинейная полировка / шлифовка, 12 мм', 250, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-edge-cnc-4', 'ЧПУ полировка / шлифовка, 4 мм', 163, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-edge-cnc-5', 'ЧПУ полировка / шлифовка, 5 мм', 163, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-edge-cnc-6', 'ЧПУ полировка / шлифовка, 6 мм', 244, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-edge-cnc-8', 'ЧПУ полировка / шлифовка, 8 мм', 293, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-edge-cnc-10', 'ЧПУ полировка / шлифовка, 10 мм', 406, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-edge-cnc-12', 'ЧПУ полировка / шлифовка, 12 мм', 488, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-tempering-4', 'Закалка стекла, 4 мм (обработка кромки включена)', 630, 'area', true, 'work', 'glass-processing'),
    service('yugros-tempering-5', 'Закалка стекла, 5 мм (обработка кромки включена)', 660, 'area', true, 'work', 'glass-processing'),
    service('yugros-tempering-6', 'Закалка стекла, 6 мм (обработка кромки включена)', 840, 'area', true, 'work', 'glass-processing'),
    service('yugros-tempering-8', 'Закалка стекла, 8 мм (обработка кромки включена)', 1190, 'area', true, 'work', 'glass-processing'),
    service('yugros-tempering-10', 'Закалка стекла, 10 мм (обработка кромки включена)', 1340, 'area', true, 'work', 'glass-processing'),
    service('yugros-tempering-12', 'Закалка стекла, 12 мм (обработка кромки включена)', 1600, 'area', true, 'work', 'glass-processing'),
    service('yugros-tempering-wash', 'Мойка стекла перед закалкой', 120, 'area', true, 'work', 'glass-processing'),
    service('yugros-sandblast-drawing', 'Пескоструй: рисунок по стеклу, зеркалу или амальгаме', 2120, 'area', true, 'work', 'glass-processing'),
    service('yugros-sandblast-solid', 'Пескоструй: сплошная обработка', 1080, 'area', true, 'work', 'glass-processing'),
    service('yugros-bevel-5-10', 'Фацет прямолинейный 5–10 мм', 100, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-bevel-15', 'Фацет прямолинейный 15 мм', 120, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-bevel-20', 'Фацет прямолинейный 20 мм', 140, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-bevel-25', 'Фацет прямолинейный 25 мм', 190, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-bevel-30', 'Фацет прямолинейный 30 мм', 250, 'perimeter', true, 'work', 'glass-processing'),
    service('yugros-bevel-35-40', 'Фацет прямолинейный 35–40 мм', 450, 'perimeter', true, 'work', 'glass-processing'),
    ...vdsMirrorComponents,
  ],
  groups: [],
  settings: {
    materialMarkupPercent: 40,
    serviceMarkupPercent: 10,
    managerPercent: 10,
    designerPercent: 10,
    discountPercent: 5,
  },
}
