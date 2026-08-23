import {
  getConstruction,
  getConstructionHardwareComponents,
  getOption,
  type CalculatorForm,
} from './calculator'
import type { PricingCatalog } from './pricing'
import {
  getShowerHardwareMachiningTemplate,
  hardwareSectionNeedsMachiningTemplate,
  type MachiningPattern,
  type ShowerHardwareMachiningTemplate,
} from './showerHardwareMachining'

export type ProductionOperationKind = 'hole' | 'notch' | 'cutout' | 'template'
export type ProductionPanelRole = 'fixed' | 'door'
export type ProductionOperationEdge = 'left' | 'right' | 'top' | 'bottom'
export type ProductionOperationProfile = 'circle' | 'round-slot' | 'hinge-cutout'

export type ProductionOperation = {
  id: string
  kind: ProductionOperationKind
  label: string
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  diameterMm: number
  radiusMm: number
  straightDepthMm: number
  edge?: ProductionOperationEdge
  profile: ProductionOperationProfile
  confirmed: boolean
  sourceSku: string
  sourceUrl?: string
}

export type ProductionPanel = {
  id: string
  label: string
  role: ProductionPanelRole
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

export type ProductionTemplateStatus = 'verified' | 'not-required' | 'missing' | 'incompatible'

export type ProductionTemplateCheck = {
  id: string
  hardwareItemId: string
  label: string
  sku: string
  quantity: number
  status: ProductionTemplateStatus
  message: string
  productUrl?: string
  drawingUrl?: string
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
  panels: ProductionPanel[]
  cuts: ProductionCutItem[]
  purchases: ProductionPurchaseItem[]
  templateChecks: ProductionTemplateCheck[]
  warnings: string[]
  blockingIssues: string[]
  notes: string
  confirmed: boolean
}

type ResolvedComponent = ReturnType<typeof getConstructionHardwareComponents>[number]
type Edge = 'left' | 'right'

const positive = (value: unknown, fallback = 0) => Math.max(0, Number(value) || fallback)

const panelLabel = (label: string, index: number) => {
  const cleaned = label.replace(/^ширина\s+/i, '').trim()
  if (!cleaned || cleaned.toLocaleLowerCase('ru') === 'ширина') return `Стекло ${index + 1}`
  return cleaned.charAt(0).toLocaleUpperCase('ru') + cleaned.slice(1)
}

const panelRolesBySketch: Record<ProductionPackage['constructionSketch'], ProductionPanelRole[]> = {
  single: ['fixed'],
  panel: ['fixed'],
  niche: ['door'],
  'panel-door': ['fixed', 'door'],
  corner: ['fixed', 'door'],
  'corner-plus': ['fixed', 'fixed', 'door'],
  'double-corner': ['fixed', 'door', 'fixed', 'door'],
  slider: ['fixed', 'door'],
  'slider-corner': ['fixed', 'door', 'fixed'],
  'slider-double': ['fixed', 'door', 'fixed', 'door'],
  trapezoid: ['fixed', 'door', 'fixed'],
}

const getPanelDefaults = (catalog: PricingCatalog, form: CalculatorForm): ProductionPanel[] => {
  const construction = getConstruction(catalog, form.constructionId)
  const heightField = construction.fields.find((field) => field.key.startsWith('HEIGHT'))
  const height = positive(heightField ? form.dimensions[heightField.key] : 0, 2000)
  const roles = panelRolesBySketch[construction.sketch]
  return construction.fields
    .filter((field) => field.key.startsWith('WIDTH'))
    .map((field, index) => {
      const width = positive(form.dimensions[field.key], field.defaultValue)
      const role = roles[index] ?? (/двер/i.test(field.label) ? 'door' : 'fixed')
      return {
        id: crypto.randomUUID(),
        label: panelLabel(field.label, index),
        role,
        shape: construction.sketch === 'trapezoid' && role === 'fixed' ? 'trapezoid' as const : 'rectangle' as const,
        widthMm: width,
        heightMm: height,
        topWidthMm: width,
        quantity: 1,
        notes: role === 'door' ? 'Дверное стекло' : 'Неподвижное стекло',
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

const spacedPositions = (count: number, height: number, margin = 250) => {
  if (count <= 0) return []
  const safeMargin = Math.min(margin, Math.max(80, height / 3))
  if (count === 1) return [height / 2]
  const span = Math.max(0, height - safeMargin * 2)
  return Array.from({ length: count }, (_, index) => safeMargin + span * index / (count - 1))
}

const hingeEdge = (_panels: ProductionPanel[], _door: ProductionPanel): Edge => 'left'
const oppositeEdge = (edge: Edge): Edge => edge === 'left' ? 'right' : 'left'
const edgeX = (panel: ProductionPanel, edge: Edge, offset: number) => edge === 'left' ? offset : panel.widthMm - offset

const addHole = (
  panel: ProductionPanel,
  component: ResolvedComponent,
  template: ShowerHardwareMachiningTemplate,
  label: string,
  xMm: number,
  yMm: number,
  diameterMm: number,
) => panel.operations.push({
  id: crypto.randomUUID(),
  kind: 'hole',
  label,
  xMm,
  yMm,
  widthMm: 0,
    heightMm: 0,
    diameterMm,
    radiusMm: diameterMm / 2,
    straightDepthMm: 0,
    profile: 'circle',
    confirmed: true,
  sourceSku: component.item.sku ?? '',
  sourceUrl: template.drawingUrl,
})

const addEdgeCut = (
  panel: ProductionPanel,
  component: ResolvedComponent,
  template: ShowerHardwareMachiningTemplate,
  kind: 'notch' | 'cutout',
  label: string,
  edge: Edge,
  yMm: number,
  depthMm: number,
  openingMm: number,
  radiusMm: number,
  profile: Extract<ProductionOperationProfile, 'round-slot' | 'hinge-cutout'>,
  straightDepthMm = Math.max(0, depthMm - radiusMm),
) => panel.operations.push({
  id: crypto.randomUUID(),
  kind,
  label,
  xMm: edgeX(panel, edge, depthMm / 2),
  yMm,
  widthMm: depthMm,
  heightMm: openingMm,
  diameterMm: 0,
  radiusMm,
  straightDepthMm,
  edge,
  profile,
  confirmed: true,
  sourceSku: component.item.sku ?? '',
  sourceUrl: template.drawingUrl,
})

const groupCountByPanel = (panels: ProductionPanel[], quantity: number) => panels.map((panel, index) => ({
  panel,
  count: Math.floor(quantity / panels.length) + (index < quantity % panels.length ? 1 : 0),
}))

const getAdjacentFixed = (panels: ProductionPanel[], door: ProductionPanel) => {
  const index = panels.indexOf(door)
  return [...panels.slice(0, index).reverse(), ...panels.slice(index + 1)].find((panel) => panel.role === 'fixed')
}

const applyMachiningPattern = (
  pattern: MachiningPattern,
  component: ResolvedComponent,
  template: ShowerHardwareMachiningTemplate,
  panels: ProductionPanel[],
) => {
  const fixedPanels = panels.filter((panel) => panel.role === 'fixed')
  const doors = panels.filter((panel) => panel.role === 'door')
  const sku = component.item.sku ?? template.skuPrefix

  if (pattern === 'wall-hinge-fdp122') {
    groupCountByPanel(doors, component.quantity).forEach(({ panel, count }) => {
      const edge = hingeEdge(panels, panel)
      spacedPositions(count, panel.heightMm).forEach((center, hingeIndex) => {
        addHole(panel, component, template, `${sku}: петля ${hingeIndex + 1}, верхнее`, edgeX(panel, edge, 34), center + 25, 16)
        addHole(panel, component, template, `${sku}: петля ${hingeIndex + 1}, нижнее`, edgeX(panel, edge, 34), center - 25, 16)
      })
    })
    return
  }

  if (pattern === 'glass-hinge-fdp115') {
    groupCountByPanel(doors, component.quantity).forEach(({ panel: door, count }) => {
      const fixed = getAdjacentFixed(panels, door)
      if (!fixed) return
      const doorEdge = hingeEdge(panels, door)
      const fixedEdge = oppositeEdge(doorEdge)
      spacedPositions(count, door.heightMm).forEach((center, hingeIndex) => {
        for (const delta of [-22.5, 22.5]) {
          addHole(door, component, template, `${sku}: петля ${hingeIndex + 1}`, edgeX(door, doorEdge, 32), center + delta, 14)
          addHole(fixed, component, template, `${sku}: ответная часть ${hingeIndex + 1}`, edgeX(fixed, fixedEdge, 32), center + delta, 14)
        }
      })
    })
    return
  }

  if (pattern === 'corner-hinge-fdp184') {
    groupCountByPanel(doors, component.quantity).forEach(({ panel: door, count }) => {
      const fixed = getAdjacentFixed(panels, door)
      if (!fixed) return
      const doorEdge = hingeEdge(panels, door)
      const fixedEdge = oppositeEdge(doorEdge)
      spacedPositions(count, door.heightMm).forEach((center, hingeIndex) => {
        addEdgeCut(door, component, template, 'cutout', `${sku}: вырез петли ${hingeIndex + 1}, R15`, doorEdge, center, 40, 40, 15, 'hinge-cutout', 25)
        addHole(fixed, component, template, `${sku}: ответная часть ${hingeIndex + 1}, верхнее`, edgeX(fixed, fixedEdge, 40), center + 15, 16)
        addHole(fixed, component, template, `${sku}: ответная часть ${hingeIndex + 1}, нижнее`, edgeX(fixed, fixedEdge, 40), center - 15, 16)
      })
    })
    return
  }

  if (pattern === 'wall-connector-fdk22' || pattern === 'wall-connector-fdk27') {
    groupCountByPanel(fixedPanels, component.quantity).forEach(({ panel, count }, panelIndex) => {
      const edge: Edge = panelIndex === 0 ? 'left' : 'right'
      spacedPositions(count, panel.heightMm, 140).forEach((center, connectorIndex) => {
        addEdgeCut(panel, component, template, 'notch', `${sku}: коннектор ${connectorIndex + 1}, R10`, edge, center, 32, 20, 10, 'round-slot', 22)
      })
    })
    return
  }

  if (pattern === 'corner-connector-fdk24') {
    const pair = fixedPanels.length >= 2 ? fixedPanels.slice(0, 2) : panels.slice(0, 2)
    if (pair.length < 2) return
    spacedPositions(component.quantity, Math.min(pair[0].heightMm, pair[1].heightMm), 140).forEach((center, index) => {
      addHole(pair[0], component, template, `${sku}: коннектор ${index + 1}, отверстие`, edgeX(pair[0], 'right', 32), center, 20)
      addEdgeCut(pair[1], component, template, 'notch', `${sku}: коннектор ${index + 1}, ответный вырез R10`, 'left', center, 32, 20, 10, 'round-slot', 22)
    })
    return
  }

  if (pattern === 'glass-connector-fdk28') {
    const pairs: Array<readonly [ProductionPanel, ProductionPanel]> = doors.flatMap((door) => {
      const fixed = getAdjacentFixed(panels, door)
      return fixed ? [[fixed, door] as const] : []
    })
    if (pairs.length === 0 && panels.length >= 2) pairs.push([panels[0], panels[1]])
    pairs.forEach((pair, pairIndex) => {
      const count = Math.floor(component.quantity / pairs.length) + (pairIndex < component.quantity % pairs.length ? 1 : 0)
      spacedPositions(count, Math.min(pair[0].heightMm, pair[1].heightMm), 140).forEach((center, index) => {
        addEdgeCut(pair[0], component, template, 'notch', `${sku}: коннектор ${index + 1}, R10`, 'right', center, 32, 20, 10, 'round-slot', 22)
        addEdgeCut(pair[1], component, template, 'notch', `${sku}: ответный вырез ${index + 1}, R10`, 'left', center, 32, 20, 10, 'round-slot', 22)
      })
    })
    return
  }

  if (pattern === 'knob-fdr30') {
    doors.forEach((door, index) => {
      const edge = oppositeEdge(hingeEdge(panels, door))
      addHole(door, component, template, `${sku}: ручка ${index + 1}`, edgeX(door, edge, 50), Math.min(1000, door.heightMm / 2), 10)
    })
    return
  }

  if (pattern === 'slider-fds1') {
    doors.forEach((door) => {
      const topOffset = 35
      for (const xMm of [80, Math.max(80, door.widthMm - 80)]) {
        addHole(door, component, template, `${sku}: ролик`, xMm, door.heightMm - topOffset, 16)
        addHole(door, component, template, `${sku}: фиксатор`, xMm, door.heightMm - topOffset - 58, 10)
      }
      addHole(door, component, template, `${sku}: вырез под ручку`, 55, Math.min(1000, door.heightMm / 2), 48)
    })
    fixedPanels.forEach((panel) => {
      const yMm = panel.heightMm - 67
      for (const xMm of [100, Math.max(100, panel.widthMm - 100)]) {
        addHole(panel, component, template, `${sku}: крепление трека`, xMm, yMm, 14)
      }
    })
  }
}

const createTemplateCheck = (
  component: ResolvedComponent,
  glassThickness: 6 | 8,
): { check: ProductionTemplateCheck; template?: ShowerHardwareMachiningTemplate } => {
  const sku = component.item.sku ?? ''
  const template = getShowerHardwareMachiningTemplate(sku)
  if (template && !template.supportedThicknesses.includes(glassThickness)) {
    return {
      template,
      check: {
        id: crypto.randomUUID(),
        hardwareItemId: component.item.id,
        label: component.item.label,
        sku,
        quantity: component.quantity,
        status: 'incompatible',
        message: `Артикул не подтверждён для стекла ${glassThickness} мм`,
        productUrl: component.item.sourceUrl,
        drawingUrl: template.drawingUrl,
      },
    }
  }
  if (template) {
    return {
      template,
      check: {
        id: crypto.randomUUID(),
        hardwareItemId: component.item.id,
        label: component.item.label,
        sku,
        quantity: component.quantity,
        status: template.pattern === 'none' ? 'not-required' : 'verified',
        message: template.sourceNote,
        productUrl: component.item.sourceUrl,
        drawingUrl: template.drawingUrl,
      },
    }
  }
  if (hardwareSectionNeedsMachiningTemplate(component.item.sectionId)) {
    return {
      check: {
        id: crypto.randomUUID(),
        hardwareItemId: component.item.id,
        label: component.item.label,
        sku,
        quantity: component.quantity,
        status: 'missing',
        message: 'На AV24 не найден подтверждённый монтажный чертёж',
        productUrl: component.item.sourceUrl,
      },
    }
  }
  return {
    check: {
      id: crypto.randomUUID(),
      hardwareItemId: component.item.id,
      label: component.item.label,
      sku,
      quantity: component.quantity,
      status: 'not-required',
      message: 'Обработка стекла для этой позиции не требуется',
      productUrl: component.item.sourceUrl,
    },
  }
}

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
  const panels = getPanelDefaults(catalog, form)
  const resolvedChecks = components.map((component) => ({
    component,
    ...createTemplateCheck(component, glassThickness),
  }))

  resolvedChecks.forEach(({ component, template, check }) => {
    if (!template || check.status !== 'verified') return
    if (template.pattern !== 'none') applyMachiningPattern(template.pattern, component, template, panels)
  })

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
  const templateChecks = resolvedChecks.map(({ check }) => check)
  const blockingIssues = templateChecks
    .filter((check) => check.status === 'missing' || check.status === 'incompatible')
    .map((check) => `${check.sku || check.label}: ${check.message}`)

  return {
    quoteNumber,
    itemIndex,
    constructionTitle: construction.title,
    constructionSketch: construction.sketch,
    glassLabel: glass.label,
    glassThickness,
    hardwareColor: hardware.label,
    hardwareClass: hardwareClass.label,
    panels,
    cuts,
    purchases,
    templateChecks,
    warnings: [
      'Контуры отверстий и вырезов построены автоматически по монтажным чертежам выбранных артикулов.',
      'Высотное расположение петель и коннекторов выполнено по производственному стандарту калькулятора.',
    ],
    blockingIssues,
    notes: '',
    confirmed: blockingIssues.length === 0,
  }
}

export const getProductionUnresolvedOperations = (draft: ProductionPackage) => draft.panels
  .flatMap((panel) => panel.operations.map((operation) => ({ panel, operation })))
  .filter(({ operation }) => !operation.confirmed)

export const getProductionValidationErrors = (draft: ProductionPackage) => {
  const errors: string[] = [...draft.blockingIssues]
  if (draft.panels.length === 0) errors.push('В расчёте не найдено ни одного стекла.')
  if (draft.panels.some((panel) => panel.widthMm <= 0 || panel.heightMm <= 0 || panel.quantity <= 0)) {
    errors.push('У всех стекол должны быть заполнены размеры и количество.')
  }
  if (getProductionUnresolvedOperations(draft).length > 0) {
    errors.push('Не все обработки подтверждены монтажными шаблонами.')
  }
  return errors
}
