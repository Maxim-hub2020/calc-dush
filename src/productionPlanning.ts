import {
  getConstruction,
  getConstructionHardwareComponents,
  getOption,
  type CalculatorForm,
} from './calculator'
import type { PricingCatalog } from './pricing'

export type ProductionOperationKind = 'hole' | 'notch' | 'cutout' | 'template'

export type ProductionOperation = {
  id: string
  kind: ProductionOperationKind
  label: string
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  diameterMm: number
  confirmed: boolean
}

export type ProductionPanel = {
  id: string
  label: string
  shape: 'rectangle' | 'trapezoid'
  widthMm: number
  heightMm: number
  topWidthMm: number
  quantity: number
  notes: string
  operations: ProductionOperation[]
}

export type ProductionCutItem = {
  id: string
  hardwareItemId: string
  label: string
  sku: string
  quantity: number
  cutLengthMm: number
  stockLengthMm: number
  stockPieces: number
  sourceUrl?: string
}

export type ProductionPurchaseItem = {
  id: string
  hardwareItemId: string
  label: string
  sku: string
  quantity: number
  sourceUrl?: string
}

export type ProductionPlanAnalysis = {
  summary: string
  confidence: number
  panels: Array<{
    label: string
    shape: 'rectangle' | 'trapezoid'
    widthMm: number
    heightMm: number
    topWidthMm: number
    quantity: number
    notes: string
  }>
  operations: Array<{
    panelLabel: string
    kind: ProductionOperationKind
    label: string
    xMm: number
    yMm: number
    widthMm: number
    heightMm: number
    diameterMm: number
    confirmedFromSource: boolean
  }>
  recognizedDimensions: Array<{ label: string; valueMm: number; source: string }>
  warnings: string[]
  needsReview: boolean
}

export type ProductionPackage = {
  quoteNumber: string
  itemIndex: number
  constructionTitle: string
  constructionSketch: ReturnType<typeof getConstruction>['sketch']
  glassLabel: string
  glassThickness: 6 | 8
  hardwareColor: string
  hardwareClass: string
  referenceImageDataUrl: string
  referenceFileName: string
  analysisSummary: string
  confidence: number | null
  recognizedDimensions: ProductionPlanAnalysis['recognizedDimensions']
  panels: ProductionPanel[]
  cuts: ProductionCutItem[]
  purchases: ProductionPurchaseItem[]
  warnings: string[]
  notes: string
  confirmed: boolean
}

const positive = (value: unknown, fallback = 0) => Math.max(0, Number(value) || fallback)

const panelLabel = (label: string, index: number) => {
  const cleaned = label.replace(/^ширина\s+/i, '').trim()
  if (!cleaned || cleaned.toLocaleLowerCase('ru') === 'ширина') return `Стекло ${index + 1}`
  return cleaned.charAt(0).toLocaleUpperCase('ru') + cleaned.slice(1)
}

const getPanelDefaults = (catalog: PricingCatalog, form: CalculatorForm): ProductionPanel[] => {
  const construction = getConstruction(catalog, form.constructionId)
  const heightField = construction.fields.find((field) => field.key.startsWith('HEIGHT'))
  const height = positive(heightField ? form.dimensions[heightField.key] : 0, 2000)
  return construction.fields
    .filter((field) => field.key.startsWith('WIDTH'))
    .map((field, index) => {
      const width = positive(form.dimensions[field.key], field.defaultValue)
      return {
        id: crypto.randomUUID(),
        label: panelLabel(field.label, index),
        shape: construction.sketch === 'trapezoid' && index !== 1 ? 'trapezoid' as const : 'rectangle' as const,
        widthMm: width,
        heightMm: height,
        topWidthMm: width,
        quantity: 1,
        notes: 'Размер перенесён из калькулятора. Проверить технологические зазоры.',
        operations: [],
      }
    })
}

const inferStockLengthMm = (label: string) => {
  const meterMatches = [...label.matchAll(/(\d+(?:[.,]\d+)?)\s*м(?!м)/gi)]
    .map((match) => Number(match[1].replace(',', '.')) * 1000)
    .filter((value) => value >= 500 && value <= 10000)
  if (meterMatches.length > 0) return Math.max(...meterMatches)
  const millimeterMatches = [...label.matchAll(/(?:^|[^\d])(\d{4,5})\s*мм/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => value >= 1000 && value <= 10000)
  return millimeterMatches.length > 0 ? Math.max(...millimeterMatches) : 2500
}

const getPlanWidth = (form: CalculatorForm) => Object.entries(form.dimensions)
  .filter(([key]) => key.startsWith('WIDTH'))
  .reduce((total, [, value]) => total + positive(value), 0)

const getCutLengthMm = (label: string, form: CalculatorForm) => {
  const normalized = label.toLocaleLowerCase('ru').replaceAll('ё', 'е')
  const height = Object.entries(form.dimensions)
    .find(([key]) => key.startsWith('HEIGHT'))?.[1] ?? 2000
  const width = Math.max(1, getPlanWidth(form))
  if (/трек|порог|направляющ|нижн|горизонт/.test(normalized)) return width
  if (/стен|вертик|магнит/.test(normalized)) return positive(height, 2000)
  if (/труб|штанг/.test(normalized)) return Math.max(...Object.entries(form.dimensions)
    .filter(([key]) => key.startsWith('WIDTH'))
    .map(([, value]) => positive(value)), width)
  return positive(height, 2000)
}

const isCutMaterial = (label: string, sectionId: string) => (
  !/креплен|держател|коннектор|заглуш|уголок|кронштейн/i.test(label)
  && (
    /профил|трек|^.*труба|штанг|порог|направляющ/i.test(label)
    || ['support-profiles', 'magnetic-profiles'].includes(sectionId)
  )
)

export const createProductionPackage = (
  catalog: PricingCatalog,
  form: CalculatorForm,
  quoteNumber: string,
  itemIndex: number,
): ProductionPackage => {
  const construction = getConstruction(catalog, form.constructionId)
  const glass = getOption(catalog.glass, form.glassId)
  const hardware = getOption(catalog.hardware, form.hardwareId)
  const hardwareClass = getOption(catalog.hardwareClass, form.hardwareClassId)
  const glassThickness = glass.thickness ?? 8
  const components = getConstructionHardwareComponents(catalog, construction, glassThickness)
  const purchases = components.map((component) => ({
    id: crypto.randomUUID(),
    hardwareItemId: component.item.id,
    label: component.item.label,
    sku: component.item.sku ?? '',
    quantity: component.quantity,
    sourceUrl: component.item.sourceUrl,
  }))
  const cuts = components.flatMap((component) => {
    if (!isCutMaterial(component.item.label, component.item.sectionId)) return []
    const cutLengthMm = getCutLengthMm(component.item.label, form)
    const stockLengthMm = inferStockLengthMm(component.item.label)
    const stockPieces = Math.max(component.quantity, Math.ceil(component.quantity * cutLengthMm / stockLengthMm))
    return [{
      id: crypto.randomUUID(),
      hardwareItemId: component.item.id,
      label: component.item.label,
      sku: component.item.sku ?? '',
      quantity: component.quantity,
      cutLengthMm,
      stockLengthMm,
      stockPieces,
      sourceUrl: component.item.sourceUrl,
    }]
  })

  return {
    quoteNumber,
    itemIndex,
    constructionTitle: construction.title,
    constructionSketch: construction.sketch,
    glassLabel: glass.label,
    glassThickness,
    hardwareColor: hardware.label,
    hardwareClass: hardwareClass.label,
    referenceImageDataUrl: '',
    referenceFileName: '',
    analysisSummary: '',
    confidence: null,
    recognizedDimensions: [],
    panels: getPanelDefaults(catalog, form),
    cuts,
    purchases,
    warnings: [
      'Размеры стекол перенесены из калькулятора без автоматических технологических вычетов.',
      'Сверления и вырезы должны быть подтверждены по чертежам выбранной фурнитуры.',
    ],
    notes: '',
    confirmed: false,
  }
}

const normalizeLabel = (value: string) => value.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim()

export const applyProductionAnalysis = (
  current: ProductionPackage,
  analysis: ProductionPlanAnalysis,
): ProductionPackage => {
  const fallbackPanels = current.panels
  const panels = (analysis.panels.length > 0 ? analysis.panels : fallbackPanels).map((panel, index) => {
    const fallback = fallbackPanels[index] ?? fallbackPanels[0]
    const label = panel.label || fallback?.label || `Стекло ${index + 1}`
    const operations = analysis.operations
      .filter((operation) => normalizeLabel(operation.panelLabel) === normalizeLabel(label))
      .map((operation) => ({
        id: crypto.randomUUID(),
        kind: operation.kind,
        label: operation.label,
        xMm: positive(operation.xMm),
        yMm: positive(operation.yMm),
        widthMm: positive(operation.widthMm),
        heightMm: positive(operation.heightMm),
        diameterMm: positive(operation.diameterMm),
        confirmed: Boolean(operation.confirmedFromSource),
      }))
    return {
      id: fallback?.id ?? crypto.randomUUID(),
      label,
      shape: panel.shape ?? fallback?.shape ?? 'rectangle',
      widthMm: positive(panel.widthMm, fallback?.widthMm),
      heightMm: positive(panel.heightMm, fallback?.heightMm),
      topWidthMm: positive(panel.topWidthMm, panel.widthMm || fallback?.topWidthMm),
      quantity: Math.max(1, Math.round(positive(panel.quantity, fallback?.quantity ?? 1))),
      notes: panel.notes || fallback?.notes || '',
      operations,
    }
  })

  return {
    ...current,
    analysisSummary: analysis.summary,
    confidence: Math.min(1, Math.max(0, Number(analysis.confidence) || 0)),
    recognizedDimensions: analysis.recognizedDimensions,
    panels,
    warnings: [...new Set([...current.warnings, ...analysis.warnings])],
    confirmed: false,
  }
}

export const getProductionUnresolvedOperations = (draft: ProductionPackage) => draft.panels
  .flatMap((panel) => panel.operations.map((operation) => ({ panel, operation })))
  .filter(({ operation }) => !operation.confirmed || (
    operation.kind === 'template'
    && operation.diameterMm <= 0
    && operation.widthMm <= 0
    && operation.heightMm <= 0
  ))

export const getProductionValidationErrors = (draft: ProductionPackage) => {
  const errors: string[] = []
  if (!draft.referenceImageDataUrl) errors.push('Загрузите вид сверху.')
  if (draft.panels.length === 0) errors.push('Добавьте хотя бы одно стекло.')
  if (draft.panels.some((panel) => panel.widthMm <= 0 || panel.heightMm <= 0 || panel.quantity <= 0)) {
    errors.push('У всех стекол должны быть заполнены размеры и количество.')
  }
  if (getProductionUnresolvedOperations(draft).length > 0) {
    errors.push('Подтвердите размеры всех сверлений и вырезов.')
  }
  if (!draft.confirmed) errors.push('Подтвердите проверку технологом.')
  return errors
}
