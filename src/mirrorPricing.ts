export type MirrorUnit = 'piece' | 'area' | 'perimeter'

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
  materials: MirrorMaterial[]
  services: MirrorService[]
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
): MirrorService => ({ id, label, price, unit, category, visibleInQuote })

export const mirrorUnitLabels: Record<MirrorUnit, string> = {
  piece: 'шт.',
  area: 'м²',
  perimeter: 'м.п.',
}

export const defaultMirrorCatalog: MirrorPricingCatalog = {
  materials: [
    material('glass-4', 'Стекло 4 мм', 950),
    material('glass-5', 'Стекло 5 мм', 1350),
    material('glass-6', 'Стекло 6 мм', 1600),
    material('glass-8', 'Стекло 8 мм', 2200),
    material('glass-10', 'Стекло 10 мм', 3400),
    material('clearvision-4', 'ClearVision 4 мм', 2800),
    material('clearvision-6', 'ClearVision 6 мм', 2300),
    material('clearvision-8', 'ClearVision 8 мм', 3400),
    material('clearvision-10', 'ClearVision 10 мм', 4500),
    material('matelux-white-4', 'Мателюкс Белое 4 мм', 1000),
    material('matelux-bronze-4', 'Мателюкс Бронза 4 мм', 1800),
    material('matelux-white-6', 'Мателюкс Белое 6 мм', 1800),
    material('matelux-white-8', 'Мателюкс Белое 8 мм', 2200),
    material('lacobel-basic-4', 'Лакобель 4 мм: белый, чёрный, светло-бежевый', 1700),
    material('lacobel-clear-white-4', 'Лакобель белый осветлённый 4 мм', 2500),
    material('mirror-graphite-4', 'Зеркало 4 мм Графит', 2100),
    material('mirror-silver-4', 'Зеркало 4 мм БЦ', 2250),
    material('mirror-clear-4', 'Зеркало 4 мм осветлённое', 5000),
    material('glass-graphite-4', 'Стекло 4 мм Графит', 2500),
    material('glass-tempered-8', 'Стекло 8 мм закалённое', 6500),
  ],
  services: [
    service('installation-glue', 'Монтаж: приклейка', 2200, 'area', true),
    service('installation-hanging', 'Монтаж: навеска', 3000, 'piece', true),
    service('dismantling', 'Демонтаж', 3000, 'piece', true),
    service('euro-edge-shaped-4', 'Еврокромка 4 мм (фигурная)', 170, 'perimeter', false),
    service('euro-edge-4', 'Еврокромка 4 мм', 80, 'perimeter', false),
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
    service('bevel-10', 'Фацет 10 мм', 200, 'perimeter', true),
  ],
  settings: {
    materialMarkupPercent: 40,
    serviceMarkupPercent: 10,
    managerPercent: 10,
    designerPercent: 10,
    discountPercent: 5,
  },
}
