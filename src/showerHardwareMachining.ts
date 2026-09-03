export type MachiningPattern =
  | 'wall-hinge-fdp122'
  | 'glass-hinge-fdp115'
  | 'corner-hinge-fdp184'
  | 'angled-hinge-fdp185'
  | 'wall-connector-fdk22'
  | 'corner-connector-fdk24'
  | 'wall-connector-fdk27'
  | 'glass-connector-fdk28'
  | 'knob-fdr30'
  | 'slider-fds1'
  | 'none'

export type ShowerHardwareMachiningTemplate = {
  skuPrefix: string
  pattern: MachiningPattern
  drawingUrl: string
  supportedThicknesses: Array<6 | 8>
  sourceNote: string
}

const templates: ShowerHardwareMachiningTemplate[] = [
  {
    skuPrefix: 'FDP-122',
    pattern: 'wall-hinge-fdp122',
    drawingUrl: 'https://av24.su/wa-data/public/site/drawings/FDP-122-ZN-av24.pdf',
    supportedThicknesses: [6, 8],
    sourceNote: '2 отверстия Ø16, межосевое 50 мм, ось 34 мм от кромки; зазор стекло-стена 6 мм',
  },
  {
    skuPrefix: 'FDP-115',
    pattern: 'glass-hinge-fdp115',
    drawingUrl: 'https://av24.su/wa-data/public/site/drawings/FDP-115-SUS304-av24.pdf',
    supportedThicknesses: [6, 8],
    sourceNote: 'На каждом стекле 2 отверстия Ø14, межосевое 45 мм, ось 32 мм от кромки; зазор между стеклами 8 мм',
  },
  {
    skuPrefix: 'FDP-184',
    pattern: 'corner-hinge-fdp184',
    drawingUrl: 'https://av24.su/wa-data/public/site/drawings/FDP-184-BR.pdf',
    supportedThicknesses: [6, 8],
    sourceNote: 'Вырез R15 на дверном стекле и 2 отверстия Ø16 на ответном стекле; угловой зазор 6 мм',
  },
  {
    skuPrefix: 'FDP-185',
    pattern: 'angled-hinge-fdp185',
    drawingUrl: 'https://av24.su/wa-data/public/site/drawings/FDP-185-%2890%29.pdf',
    supportedThicknesses: [6, 8],
    sourceNote: 'Петля 135°: вырез R15 на двери; на ответном стекле 2 кромочных выреза R9 с межосевым 28 мм',
  },
  {
    skuPrefix: 'FDK-22',
    pattern: 'wall-connector-fdk22',
    drawingUrl: 'https://av24.su/wa-data/public/site/drawings/FDK-22-SUS.pdf',
    supportedThicknesses: [8],
    sourceNote: 'Кромочный вырез 20 × 22 мм, R10',
  },
  {
    skuPrefix: 'FDK-24',
    pattern: 'corner-connector-fdk24',
    drawingUrl: 'https://av24.su/wa-data/public/site/drawings/FDK-24-SUS.pdf',
    supportedThicknesses: [8],
    sourceNote: 'Отверстие Ø20 на одном стекле, кромочный вырез 20 × 22 мм на ответном',
  },
  {
    skuPrefix: 'FDK-27',
    pattern: 'wall-connector-fdk27',
    drawingUrl: 'https://av24.su/wa-data/public/site/drawings/FDK-27-BR.pdf',
    supportedThicknesses: [8],
    sourceNote: 'Кромочный вырез 20 × 22 мм, R10',
  },
  {
    skuPrefix: 'FDK-28',
    pattern: 'glass-connector-fdk28',
    drawingUrl: 'https://av24.su/wa-data/public/site/drawings/FDK-28_BR.pdf',
    supportedThicknesses: [6, 8],
    sourceNote: 'Кромочный вырез 20 × 22 мм, R10 на обоих стеклах',
  },
  {
    skuPrefix: 'FDR-30',
    pattern: 'knob-fdr30',
    drawingUrl: 'https://av24.su/wa-data/public/site/drawings/FDR-30-AL.pdf',
    supportedThicknesses: [8],
    sourceNote: 'Одно отверстие Ø10',
  },
  {
    skuPrefix: 'FDS-1',
    pattern: 'slider-fds1',
    drawingUrl: 'https://av24.su/wa-data/public/shop/products/10/29/2910/images/12989/12989.970x0.jpg',
    supportedThicknesses: [8],
    sourceNote: 'Карта отверстий роликов, креплений трека и вырез Ø48 под ручку; дверное стекло L/2 + 50 мм',
  },
  {
    skuPrefix: 'FDC-12',
    pattern: 'none',
    drawingUrl: 'https://av24.su/wa-data/public/site/drawings/FDC-12-BR.pdf',
    supportedThicknesses: [8],
    sourceNote: 'Зажимное крепление, обработка стекла не требуется',
  },
  {
    skuPrefix: 'FDC-33',
    pattern: 'none',
    drawingUrl: 'https://av24.su/wa-data/public/site/drawings/FDC-33-av24.pdf',
    supportedThicknesses: [8],
    sourceNote: 'Торцевое зажимное крепление, обработка стекла не требуется',
  },
  {
    skuPrefix: 'FDC-35',
    pattern: 'none',
    drawingUrl: 'https://av24.su/wa-data/public/shop/img/fdc-35-av24.jpg',
    supportedThicknesses: [8],
    sourceNote: 'Зажимное крепление к кромке стекла, обработка стекла не требуется',
  },
  {
    skuPrefix: 'FDC-14',
    pattern: 'none',
    drawingUrl: 'https://av24.su/wa-data/public/site/drawings/FDC-14-BR.pdf',
    supportedThicknesses: [6, 8],
    sourceNote: 'Крепление трубы Ø18/19 мм к стене; со стеклом не соединяется',
  },
  {
    skuPrefix: 'FDC-30',
    pattern: 'none',
    drawingUrl: 'https://av24.su/wa-data/public/site/drawings/FDC-30-SUS304.pdf',
    supportedThicknesses: [6, 8],
    sourceNote: 'Крепление трека 30 × 10 мм к стене; со стеклом не соединяется',
  },
]

const normalizedSku = (value: string) => value.trim().toLocaleUpperCase('ru')

export const getShowerHardwareMachiningTemplate = (sku: string) => {
  const normalized = normalizedSku(sku)
  return templates.find((template) => normalized.startsWith(template.skuPrefix))
}

export const hardwareSectionNeedsMachiningTemplate = (sectionId: string) => [
  'hinges',
  'connectors',
  'handles',
  'bar-connectors',
  'sets',
  'sliding',
  'sliding-systems',
].includes(sectionId)
