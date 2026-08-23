import {
  getConstruction,
  getConstructionHardwareComponents,
  getOption,
  type CalculatorForm,
  type ShowerProductionDesign,
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

export type ProductionClearance = {
  id: string
  label: string
  edge: ProductionOperationEdge
  valueMm: number
  widthAdjustmentMm: number
  heightAdjustmentMm: number
  sourceSku: string
  sourceUrl?: string
}

export type ProductionConnectorPlacement = {
  id: string
  hardwareItemId: string
  panelIndex: number
  panelLabel: string
  label: string
  sku: string
  verticalCount: number
  horizontalCount: number
  verticalEdge: Extract<ProductionOperationEdge, 'left' | 'right'>
  horizontalEdge: Extract<ProductionOperationEdge, 'top' | 'bottom'>
  mountType: 'connectors' | 'profile'
  profileHardwareItemId?: string
  sourceUrl?: string
}

export type ProductionMagneticPlacement = {
  id: string
  hardwareItemId: string
  panelIndex: number
  panelLabel: string
  label: string
  sku: string
  edge: Extract<ProductionOperationEdge, 'left' | 'right'>
  pairedPanelIndex?: number
  pairedPanelLabel?: string
  pairedEdge?: Extract<ProductionOperationEdge, 'left' | 'right'>
  jointType: 'corner-90' | 'corner-135' | 'inline-180' | 'wall-strike' | 'invalid'
  gapMm: number
  strikeWidthMm: number
  strikeProfilePresent: boolean
  sourceUrl?: string
}

export type ProductionDoorPlacement = {
  id: string
  panelIndex: number
  panelLabel: string
  motionType: 'hinged' | 'sliding'
  hingeEdge: Extract<ProductionOperationEdge, 'left' | 'right'>
  swingDirection: 'inward' | 'outward'
}

export type ProductionOpeningSegment = {
  id: string
  label: string
  lengthMm: number
  panelIndexes: number[]
}

export type ProductionDesignOverrides = ShowerProductionDesign

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
  openingWidthMm: number
  openingHeightMm: number
  widthMm: number
  heightMm: number
  topWidthMm: number
  quantity: number
  notes: string
  clearances: ProductionClearance[]
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
  openingHeightMm: number
  openingSegments: ProductionOpeningSegment[]
  panels: ProductionPanel[]
  doorPlacements: ProductionDoorPlacement[]
  connectorPlacements: ProductionConnectorPlacement[]
  magneticPlacements: ProductionMagneticPlacement[]
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

const getOpeningPanelGroups = (
  sketch: ProductionPackage['constructionSketch'],
  panelCount: number,
): number[][] => {
  if (sketch === 'trapezoid') {
    return Array.from({ length: panelCount }, (_, index) => [index])
  }
  if (sketch === 'corner') return [[0], [1]].filter((group) => group[0] < panelCount)
  if (sketch === 'corner-plus') return [[0], [1, 2]].map((group) => group.filter((index) => index < panelCount)).filter((group) => group.length > 0)
  if (sketch === 'double-corner' || sketch === 'slider-double') return [[0, 1], [3, 2]].map((group) => group.filter((index) => index < panelCount)).filter((group) => group.length > 0)
  if (sketch === 'slider-corner') return [[0, 1], [2]].map((group) => group.filter((index) => index < panelCount)).filter((group) => group.length > 0)
  return [Array.from({ length: panelCount }, (_, index) => index)]
}

type PanelConnection = {
  panelIndex: number
  edge: Edge
  angle: 90 | 135 | 180
}

const getPanelConnection = (
  sketch: ProductionPackage['constructionSketch'],
  openingSegments: ProductionOpeningSegment[],
  panelIndex: number,
  edge: Edge,
): PanelConnection | undefined => {
  const segmentIndex = openingSegments.findIndex((segment) => segment.panelIndexes.includes(panelIndex))
  const segment = openingSegments[segmentIndex]
  if (!segment) return undefined
  const position = segment.panelIndexes.indexOf(panelIndex)
  const neighborIndex = edge === 'left' ? position - 1 : position + 1
  if (neighborIndex >= 0 && neighborIndex < segment.panelIndexes.length) {
    return {
      panelIndex: segment.panelIndexes[neighborIndex],
      edge: edge === 'left' ? 'right' : 'left',
      angle: 180,
    }
  }

  const crossConnections: Array<{
    firstSegment: number
    firstEdge: Edge
    secondSegment: number
    secondEdge: Edge
    angle: 90 | 135
  }> = sketch === 'trapezoid'
    ? [
        { firstSegment: 0, firstEdge: 'right', secondSegment: 1, secondEdge: 'left', angle: 135 },
        { firstSegment: 1, firstEdge: 'right', secondSegment: 2, secondEdge: 'left', angle: 135 },
      ]
    : ['corner', 'corner-plus', 'double-corner', 'slider-corner', 'slider-double'].includes(sketch)
      ? [{ firstSegment: 0, firstEdge: 'right', secondSegment: 1, secondEdge: 'left', angle: 90 }]
      : []

  for (const connection of crossConnections) {
    const first = openingSegments[connection.firstSegment]?.panelIndexes
    const second = openingSegments[connection.secondSegment]?.panelIndexes
    if (!first?.length || !second?.length) continue
    const firstPanelIndex = connection.firstEdge === 'right' ? first.at(-1) : first[0]
    const secondPanelIndex = connection.secondEdge === 'left' ? second[0] : second.at(-1)
    if (segmentIndex === connection.firstSegment && panelIndex === firstPanelIndex && edge === connection.firstEdge) {
      return { panelIndex: secondPanelIndex!, edge: connection.secondEdge, angle: connection.angle }
    }
    if (segmentIndex === connection.secondSegment && panelIndex === secondPanelIndex && edge === connection.secondEdge) {
      return { panelIndex: firstPanelIndex!, edge: connection.firstEdge, angle: connection.angle }
    }
  }
  return undefined
}

const getOpeningSegmentLabel = (
  sketch: ProductionPackage['constructionSketch'],
  segmentIndex: number,
  segmentCount: number,
) => {
  if (sketch === 'trapezoid') {
    return ['Левая сторона поддона', 'Фасад поддона', 'Правая сторона поддона'][segmentIndex]
      ?? `Сторона поддона ${segmentIndex + 1}`
  }
  if (segmentCount > 1) return `Сторона поддона ${String.fromCharCode(65 + segmentIndex)}`
  return 'Ширина чистого проёма'
}

const distributeOpeningLength = (
  targetLength: number,
  panelIndexes: number[],
  originalWidths: number[],
  roles: ProductionPanelRole[],
) => {
  const result = new Map<number, number>()
  const total = panelIndexes.reduce((sum, index) => sum + originalWidths[index], 0)
  const doorIndexes = panelIndexes.filter((index) => roles[index] === 'door')
  const fixedIndexes = panelIndexes.filter((index) => roles[index] !== 'door')
  const doorTotal = doorIndexes.reduce((sum, index) => sum + originalWidths[index], 0)

  if (doorIndexes.length > 0 && fixedIndexes.length > 0 && targetLength > doorTotal + fixedIndexes.length) {
    doorIndexes.forEach((index) => result.set(index, originalWidths[index]))
    const fixedTarget = targetLength - doorTotal
    const fixedTotal = fixedIndexes.reduce((sum, index) => sum + originalWidths[index], 0)
    fixedIndexes.forEach((index) => result.set(index, fixedTarget * originalWidths[index] / Math.max(1, fixedTotal)))
    return result
  }

  panelIndexes.forEach((index) => result.set(index, targetLength * originalWidths[index] / Math.max(1, total)))
  return result
}

const getPanelDefaults = (
  catalog: PricingCatalog,
  form: CalculatorForm,
  overrides?: ProductionDesignOverrides['opening'],
): { panels: ProductionPanel[]; openingHeightMm: number; openingSegments: ProductionOpeningSegment[] } => {
  const construction = getConstruction(catalog, form.constructionId)
  const heightField = construction.fields.find((field) => field.key.startsWith('HEIGHT'))
  const defaultHeight = positive(heightField ? form.dimensions[heightField.key] : 0, 2000)
  const openingHeightMm = positive(overrides?.heightMm, defaultHeight)
  const roles = panelRolesBySketch[construction.sketch]
  const widthFields = construction.fields.filter((field) => field.key.startsWith('WIDTH'))
  const originalWidths = widthFields.map((field) => positive(form.dimensions[field.key], field.defaultValue))
  const groups = getOpeningPanelGroups(construction.sketch, widthFields.length)
  const allocatedWidths = new Map<number, number>()
  const openingSegments = groups.map((panelIndexes, segmentIndex) => {
    const id = `opening-segment-${segmentIndex + 1}`
    const defaultLength = panelIndexes.reduce((sum, index) => sum + originalWidths[index], 0)
    const lengthMm = positive(overrides?.segments?.[id], defaultLength)
    const isSlidingPair = ['slider', 'slider-corner', 'slider-double'].includes(construction.sketch)
      && panelIndexes.length === 2
      && panelIndexes.some((index) => roles[index] === 'door')
      && panelIndexes.some((index) => roles[index] === 'fixed')
    if (isSlidingPair) {
      panelIndexes.forEach((index) => allocatedWidths.set(index, lengthMm / 2))
    } else {
      distributeOpeningLength(lengthMm, panelIndexes, originalWidths, roles).forEach((value, index) => allocatedWidths.set(index, value))
    }
    return {
      id,
      label: getOpeningSegmentLabel(construction.sketch, segmentIndex, groups.length),
      lengthMm,
      panelIndexes,
    }
  })
  const panels = widthFields.map((field, index) => {
      const openingWidth = allocatedWidths.get(index) ?? originalWidths[index]
      const role = roles[index] ?? (/двер/i.test(field.label) ? 'door' : 'fixed')
      return {
        id: `panel-${index + 1}`,
        label: panelLabel(field.label, index),
        role,
        shape: construction.sketch === 'trapezoid' && role === 'fixed' ? 'trapezoid' as const : 'rectangle' as const,
        openingWidthMm: openingWidth,
        openingHeightMm,
        widthMm: openingWidth,
        heightMm: openingHeightMm,
        topWidthMm: openingWidth,
        quantity: 1,
        notes: role === 'door' ? 'Дверное стекло' : 'Неподвижное стекло',
        clearances: [],
        operations: [],
      }
    })
  return { panels, openingHeightMm, openingSegments }
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

const getCutLengthMm = (
  label: string,
  form: CalculatorForm,
  openingSegments?: ProductionOpeningSegment[],
  openingHeightMm?: number,
) => {
  const normalized = label.toLocaleLowerCase('ru').replaceAll('ё', 'е')
  const height = openingHeightMm ?? Object.entries(form.dimensions)
    .find(([key]) => key.startsWith('HEIGHT'))?.[1] ?? 2000
  const segmentLengths = openingSegments?.map((segment) => segment.lengthMm) ?? []
  const width = Math.max(1, segmentLengths.length > 0 ? segmentLengths.reduce((sum, value) => sum + value, 0) : getPlanWidth(form))
  if (/трек|порог|направляющ|нижн|горизонт/.test(normalized)) return width
  if (/стен|вертик|магнит/.test(normalized)) return positive(height, 2000)
  if (/труб|штанг/.test(normalized)) return segmentLengths.length > 0
    ? Math.max(...segmentLengths)
    : Math.max(...Object.entries(form.dimensions)
      .filter(([key]) => key.startsWith('WIDTH'))
      .map(([, value]) => positive(value)), width)
  return positive(height, 2000)
}

const isCutMaterial = (label: string, sectionId: string) => {
  if (['support-profiles', 'magnetic-profiles'].includes(sectionId)) return true
  return !/креплен|держател|коннектор|заглуш|уголок|кронштейн/i.test(label)
    && /профил|трек|^.*труба|штанг|порог|направляющ/i.test(label)
}

const spacedPositions = (count: number, height: number, margin = 250) => {
  if (count <= 0) return []
  const safeMargin = Math.min(margin, Math.max(80, height / 3))
  if (count === 1) return [height / 2]
  const span = Math.max(0, height - safeMargin * 2)
  return Array.from({ length: count }, (_, index) => safeMargin + span * index / (count - 1))
}

const hingeEdge = (
  panels: ProductionPanel[],
  door: ProductionPanel,
  openingSegments?: ProductionOpeningSegment[],
): Edge => {
  const doorIndex = panels.indexOf(door)
  const group = openingSegments?.find((segment) => segment.panelIndexes.includes(doorIndex))?.panelIndexes
  if (group) {
    const position = group.indexOf(doorIndex)
    const fixedBefore = group.slice(0, position).reverse().find((index) => panels[index]?.role === 'fixed')
    const fixedAfter = group.slice(position + 1).find((index) => panels[index]?.role === 'fixed')
    if (fixedBefore !== undefined) return 'left'
    if (fixedAfter !== undefined) return 'right'
  }
  const fixedIndex = panels.indexOf(getAdjacentFixed(panels, door) ?? door)
  return fixedIndex > doorIndex ? 'right' : 'left'
}
const oppositeEdge = (edge: Edge): Edge => edge === 'left' ? 'right' : 'left'
const createDoorPlacements = (
  panels: ProductionPanel[],
  openingSegments: ProductionOpeningSegment[],
  constructionSketch: ProductionPackage['constructionSketch'],
  resolvedChecks: Array<{ template?: ShowerHardwareMachiningTemplate }>,
  overrides?: ProductionDesignOverrides['doors'],
) => panels.flatMap((panel, panelIndex) => {
  if (panel.role !== 'door') return []
  const id = `door:${panelIndex}`
  const override = overrides?.[id]
  const inferredHingeEdge = hingeEdge(panels, panel, openingSegments)
  const wallHingeEdge = (['left', 'right'] as const).find((edge) => (
    !getPanelConnection(constructionSketch, openingSegments, panelIndex, edge)
  ))
  const usesWallHinge = resolvedChecks.some(({ template }) => template?.pattern === 'wall-hinge-fdp122')
  const usesSlider = resolvedChecks.some(({ template }) => template?.pattern === 'slider-fds1')
  return [{
    id,
    panelIndex,
    panelLabel: panel.label,
    motionType: usesSlider ? 'sliding' : 'hinged',
    hingeEdge: override?.hingeEdge ?? (usesWallHinge ? wallHingeEdge ?? inferredHingeEdge : inferredHingeEdge),
    swingDirection: override?.swingDirection ?? 'outward',
  } satisfies ProductionDoorPlacement]
})
const getDoorHingeEdge = (
  panels: ProductionPanel[],
  door: ProductionPanel,
  doorPlacements: ProductionDoorPlacement[],
) => doorPlacements.find((placement) => placement.panelIndex === panels.indexOf(door))?.hingeEdge ?? hingeEdge(panels, door)
const edgeX = (panel: ProductionPanel, edge: Edge, offset: number) => edge === 'left' ? offset : panel.widthMm - offset

const addWidthClearance = (
  panel: ProductionPanel,
  label: string,
  edge: Edge,
  valueMm: number,
  widthAdjustmentMm: number,
  sourceSku: string,
  sourceUrl?: string,
) => {
  const key = `${sourceSku}|${label}|${edge}`
  if (panel.clearances.some((item) => `${item.sourceSku}|${item.label}|${item.edge}` === key)) return
  panel.clearances.push({
    id: crypto.randomUUID(),
    label,
    edge,
    valueMm,
    widthAdjustmentMm,
    heightAdjustmentMm: 0,
    sourceSku,
    sourceUrl,
  })
  panel.widthMm = Math.max(1, panel.widthMm + widthAdjustmentMm)
  panel.topWidthMm = Math.max(1, panel.topWidthMm + widthAdjustmentMm)
}

const addHeightClearance = (
  panel: ProductionPanel,
  label: string,
  edge: Extract<ProductionOperationEdge, 'top' | 'bottom'>,
  valueMm: number,
  heightAdjustmentMm: number,
  sourceSku: string,
  sourceUrl?: string,
) => {
  const key = `${sourceSku}|${label}|${edge}`
  if (panel.clearances.some((item) => `${item.sourceSku}|${item.label}|${item.edge}` === key)) return
  panel.clearances.push({
    id: crypto.randomUUID(),
    label,
    edge,
    valueMm,
    widthAdjustmentMm: 0,
    heightAdjustmentMm,
    sourceSku,
    sourceUrl,
  })
  panel.heightMm = Math.max(1, panel.heightMm + heightAdjustmentMm)
}

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
  edge: ProductionOperationEdge,
  positionMm: number,
  depthMm: number,
  openingMm: number,
  radiusMm: number,
  profile: Extract<ProductionOperationProfile, 'round-slot' | 'hinge-cutout'>,
  straightDepthMm = Math.max(0, depthMm - radiusMm),
) => {
  const horizontalEdge = edge === 'top' || edge === 'bottom'
  panel.operations.push({
    id: crypto.randomUUID(),
    kind,
    label,
    xMm: horizontalEdge ? positionMm : edgeX(panel, edge, depthMm / 2),
    yMm: horizontalEdge
      ? edge === 'bottom' ? depthMm / 2 : panel.heightMm - depthMm / 2
      : positionMm,
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
}

const groupCountByPanel = (panels: ProductionPanel[], quantity: number) => panels.map((panel, index) => ({
  panel,
  count: Math.floor(quantity / panels.length) + (index < quantity % panels.length ? 1 : 0),
}))

const getAdjacentFixed = (panels: ProductionPanel[], door: ProductionPanel) => {
  const index = panels.indexOf(door)
  return [...panels.slice(0, index).reverse(), ...panels.slice(index + 1)].find((panel) => panel.role === 'fixed')
}

const getFixedOnDoorSide = (
  panels: ProductionPanel[],
  door: ProductionPanel,
  edge: Edge,
  openingSegments?: ProductionOpeningSegment[],
) => {
  const index = panels.indexOf(door)
  const group = openingSegments?.find((segment) => segment.panelIndexes.includes(index))?.panelIndexes
  if (group) {
    const position = group.indexOf(index)
    const candidateIndexes = edge === 'left'
      ? group.slice(0, position).reverse()
      : group.slice(position + 1)
    const fixedIndex = candidateIndexes.find((panelIndex) => panels[panelIndex]?.role === 'fixed')
    if (fixedIndex !== undefined) return panels[fixedIndex]
  }
  const candidates = edge === 'left'
    ? panels.slice(0, index).reverse()
    : panels.slice(index + 1)
  return candidates.find((panel) => panel.role === 'fixed')
}

const clampCount = (value: unknown, maximum: number) => Math.min(maximum, Math.max(0, Math.round(Number(value) || 0)))

const createConnectorPlacements = (
  resolvedChecks: Array<{
    component: ResolvedComponent
    template?: ShowerHardwareMachiningTemplate
    check: ProductionTemplateCheck
  }>,
  panels: ProductionPanel[],
  overrides?: ProductionDesignOverrides['connectors'],
) => resolvedChecks.flatMap(({ component, template, check }) => {
  if (!template || check.status !== 'verified' || !['wall-connector-fdk22', 'wall-connector-fdk27'].includes(template.pattern)) return []
  const fixedPanels = panels.map((panel, panelIndex) => ({ panel, panelIndex })).filter(({ panel }) => panel.role === 'fixed')
  return groupCountByPanel(fixedPanels.map(({ panel }) => panel), component.quantity).map(({ panel, count }) => {
    const panelIndex = panels.indexOf(panel)
    const id = `${component.item.id}:${panelIndex}`
    const override = overrides?.[id]
    const verticalCount = clampCount(override?.verticalCount ?? Math.min(3, count), 3)
    const horizontalCount = clampCount(override?.horizontalCount ?? Math.max(0, count - verticalCount), 2)
    return {
      id,
      hardwareItemId: component.item.id,
      panelIndex,
      panelLabel: panel.label,
      label: component.item.label,
      sku: component.item.sku ?? template.skuPrefix,
      verticalCount,
      horizontalCount,
      verticalEdge: override?.verticalEdge ?? (panelIndex === 0 ? 'left' : 'right'),
      horizontalEdge: override?.horizontalEdge ?? 'bottom',
      mountType: override?.mountType ?? 'connectors',
      profileHardwareItemId: override?.profileHardwareItemId,
      sourceUrl: template.drawingUrl,
    } satisfies ProductionConnectorPlacement
  })
})

const magneticDrawingUrl = (sku: string) => {
  if (/FDPP-50[12]\.6/i.test(sku)) return 'https://av24.su/wa-data/public/site/drawings/FDPP-501.6.pdf'
  if (/FDPP-(?:202|212|502|512|522)\.8/i.test(sku)) {
    return 'https://av24.su/wa-data/public/site/drawings/FDPP-202.8%2C212.8%2C502.8%2C512.8%2C522.8.pdf'
  }
  return undefined
}

const verifiedMagneticGapMm = (
  jointType: ProductionMagneticPlacement['jointType'],
) => {
  if (jointType === 'corner-90' || jointType === 'corner-135') return 6
  if (jointType === 'inline-180' || jointType === 'wall-strike') return 22
  return 0
}

const magneticJointType = (angle: PanelConnection['angle']): ProductionMagneticPlacement['jointType'] => {
  if (angle === 90) return 'corner-90'
  if (angle === 135) return 'corner-135'
  return 'inline-180'
}

const createMagneticPlacements = (
  resolvedChecks: Array<{
    component: ResolvedComponent
    template?: ShowerHardwareMachiningTemplate
    check: ProductionTemplateCheck
  }>,
  panels: ProductionPanel[],
  doorPlacements: ProductionDoorPlacement[],
  constructionSketch: ProductionPackage['constructionSketch'],
  openingSegments: ProductionOpeningSegment[],
  placementIssues: string[],
  overrides?: ProductionDesignOverrides['magnetic'],
) => {
  const magneticSeal = resolvedChecks.find(({ component }) => (
    /магнит/i.test(component.item.label)
    && /FDPP-|уплотнител/i.test(component.item.sku ?? component.item.label)
  ))?.component
  if (!magneticSeal) return []
  const sku = magneticSeal.item.sku ?? magneticSeal.item.label
  const doors = panels.map((panel, panelIndex) => ({ panel, panelIndex })).filter(({ panel }) => panel.role === 'door')
  const wallStrike = resolvedChecks.find(({ component }) => component.item.sectionId === 'magnetic-profiles')?.component
  if (doors.length >= 2) {
    const [first, second] = doors
    const id = `${magneticSeal.item.id}:joint:${first.panelIndex}:${second.panelIndex}`
    const override = overrides?.[id]
    const firstEdge = oppositeEdge(getDoorHingeEdge(panels, first.panel, doorPlacements))
    const secondEdge = oppositeEdge(getDoorHingeEdge(panels, second.panel, doorPlacements))
    const connection = getPanelConnection(constructionSketch, openingSegments, first.panelIndex, firstEdge)
    const jointType = connection?.panelIndex === second.panelIndex && connection.edge === secondEdge
      ? magneticJointType(connection.angle)
      : 'invalid'
    if (jointType === 'invalid') {
      placementIssues.push(`${sku}: магнитные кромки дверей не сходятся; магнит должен быть напротив петель на обеих створках`)
    }
    return [{
      id,
      hardwareItemId: magneticSeal.item.id,
      panelIndex: first.panelIndex,
      panelLabel: first.panel.label,
      label: magneticSeal.item.label,
      sku,
      edge: firstEdge,
      pairedPanelIndex: second.panelIndex,
      pairedPanelLabel: second.panel.label,
      pairedEdge: secondEdge,
      jointType,
      gapMm: Math.max(0, Number(override?.gapMm ?? verifiedMagneticGapMm(jointType)) || 0),
      strikeWidthMm: 0,
      strikeProfilePresent: true,
      sourceUrl: magneticDrawingUrl(sku) ?? magneticSeal.item.sourceUrl,
    } satisfies ProductionMagneticPlacement]
  }
  return doors.map(({ panel, panelIndex }) => {
    const id = `${magneticSeal.item.id}:${panelIndex}`
    const override = overrides?.[id]
    const edge = oppositeEdge(getDoorHingeEdge(panels, panel, doorPlacements))
    const connection = getPanelConnection(constructionSketch, openingSegments, panelIndex, edge)
    const pairedPanel = connection ? panels[connection.panelIndex] : undefined
    const jointType = connection ? magneticJointType(connection.angle) : 'wall-strike'
    if (jointType === 'wall-strike' && !wallStrike) {
      placementIssues.push(`${sku}: для притвора к стене добавьте в состав профиль-притвор`)
    }
    return {
      id,
      hardwareItemId: magneticSeal.item.id,
      panelIndex,
      panelLabel: panel.label,
      label: magneticSeal.item.label,
      sku,
      edge,
      pairedPanelIndex: connection?.panelIndex,
      pairedPanelLabel: pairedPanel?.label,
      pairedEdge: connection?.edge,
      jointType,
      gapMm: Math.max(0, Number(override?.gapMm ?? verifiedMagneticGapMm(jointType)) || 0),
      strikeWidthMm: jointType === 'wall-strike'
        ? Math.max(0, Number(override?.strikeWidthMm ?? 10) || 0)
        : 0,
      strikeProfilePresent: jointType !== 'wall-strike' || Boolean(wallStrike),
      sourceUrl: magneticDrawingUrl(sku) ?? magneticSeal.item.sourceUrl,
    } satisfies ProductionMagneticPlacement
  })
}

const applyVerifiedClearances = (
  resolvedChecks: Array<{
    component: ResolvedComponent
    template?: ShowerHardwareMachiningTemplate
    check: ProductionTemplateCheck
  }>,
  panels: ProductionPanel[],
  magneticPlacements: ProductionMagneticPlacement[],
  doorPlacements: ProductionDoorPlacement[],
) => {
  const doors = panels.filter((panel) => panel.role === 'door')

  resolvedChecks.forEach(({ component, template, check }) => {
    if (!template || check.status !== 'verified') return
    const sku = component.item.sku ?? template.skuPrefix
    if (template.pattern === 'wall-hinge-fdp122') {
      doors.forEach((door) => addWidthClearance(
        door,
        'Зазор стекло-стена по петле',
        getDoorHingeEdge(panels, door, doorPlacements),
        6,
        -6,
        sku,
        template.drawingUrl,
      ))
    } else if (template.pattern === 'glass-hinge-fdp115') {
      doors.forEach((door) => addWidthClearance(
        door,
        'Зазор стекло-стекло по петле',
        getDoorHingeEdge(panels, door, doorPlacements),
        8,
        -8,
        sku,
        template.drawingUrl,
      ))
    } else if (template.pattern === 'corner-hinge-fdp184') {
      doors.forEach((door) => addWidthClearance(
        door,
        'Угловой зазор стекло-стекло по петле',
        getDoorHingeEdge(panels, door, doorPlacements),
        6,
        -6,
        sku,
        template.drawingUrl,
      ))
    } else if (template.pattern === 'slider-fds1') {
      doors.forEach((door) => addWidthClearance(
        door,
        'Перехлёст раздвижной створки',
        getDoorHingeEdge(panels, door, doorPlacements),
        50,
        50,
        sku,
        template.drawingUrl,
      ))
    }
  })

  magneticPlacements.forEach((placement) => {
    const door = panels[placement.panelIndex]
    if (!door || door.role !== 'door' || placement.jointType === 'invalid') return
    const pairedPanel = placement.pairedPanelIndex === undefined ? undefined : panels[placement.pairedPanelIndex]
    const isCornerJoint = placement.jointType === 'corner-90' || placement.jointType === 'corner-135'
    const primaryGap = placement.jointType === 'wall-strike'
      ? placement.gapMm + placement.strikeWidthMm
      : pairedPanel && !isCornerJoint ? placement.gapMm / 2 : placement.gapMm
    addWidthClearance(
      door,
      placement.jointType === 'wall-strike'
        ? `Притвор к стене: магнит ${placement.gapMm} мм + профиль ${placement.strikeWidthMm} мм`
        : isCornerJoint ? `Угловой магнитный притвор ${placement.jointType === 'corner-90' ? '90°' : '135°'}` : 'Зазор магнитного притвора 180°',
      placement.edge,
      primaryGap,
      -primaryGap,
      placement.sku,
      placement.sourceUrl,
    )
    if (pairedPanel) {
      const pairedGap = isCornerJoint ? placement.gapMm : placement.gapMm - primaryGap
      addWidthClearance(
      pairedPanel,
      isCornerJoint ? `Ответная часть магнитного притвора ${placement.jointType === 'corner-90' ? '90°' : '135°'}` : 'Ответная часть магнитного притвора 180°',
      placement.pairedEdge ?? 'left',
      pairedGap,
      -pairedGap,
      placement.sku,
      placement.sourceUrl,
      )
    }
  })

  const sliderTemplate = resolvedChecks.find(({ template, check }) => (
    template?.pattern === 'slider-fds1' && check.status === 'verified'
  ))
  doors.forEach((door) => addHeightClearance(
    door,
    sliderTemplate
      ? 'Подвижное стекло: зазор под нижнюю направляющую'
      : 'Нижний зазор двери под уплотнитель',
    'bottom',
    10,
    -10,
    sliderTemplate?.component.item.sku ?? 'СТАНДАРТ АМАЛЬГАМА',
    sliderTemplate?.template?.drawingUrl,
  ))
}

const applyMachiningPattern = (
  pattern: MachiningPattern,
  component: ResolvedComponent,
  template: ShowerHardwareMachiningTemplate,
  panels: ProductionPanel[],
  placementIssues: string[],
  connectorPlacements: ProductionConnectorPlacement[],
  doorPlacements: ProductionDoorPlacement[],
  openingSegments: ProductionOpeningSegment[],
) => {
  const fixedPanels = panels.filter((panel) => panel.role === 'fixed')
  const doors = panels.filter((panel) => panel.role === 'door')
  const sku = component.item.sku ?? template.skuPrefix

  if (pattern === 'wall-hinge-fdp122') {
    if (doors.length === 0) placementIssues.push(`${sku}: в конструкции нет дверного стекла для установки петли`)
    groupCountByPanel(doors, component.quantity).forEach(({ panel, count }) => {
      const edge = getDoorHingeEdge(panels, panel, doorPlacements)
      const panelIndex = panels.indexOf(panel)
      if (getPanelConnection(
        panel.shape === 'trapezoid' ? 'trapezoid' : openingSegments.length > 1 ? 'corner' : 'niche',
        openingSegments,
        panelIndex,
        edge,
      )) {
        placementIssues.push(`${sku}: выбранная сторона петли примыкает к стеклу, а петля рассчитана на крепление к стене`)
        return
      }
      spacedPositions(count, panel.heightMm).forEach((center, hingeIndex) => {
        addHole(panel, component, template, `${sku}: петля ${hingeIndex + 1}, верхнее`, edgeX(panel, edge, 34), center + 25, 16)
        addHole(panel, component, template, `${sku}: петля ${hingeIndex + 1}, нижнее`, edgeX(panel, edge, 34), center - 25, 16)
      })
    })
    return
  }

  if (pattern === 'glass-hinge-fdp115') {
    groupCountByPanel(doors, component.quantity).forEach(({ panel: door, count }) => {
      const doorEdge = getDoorHingeEdge(panels, door, doorPlacements)
      const fixed = getFixedOnDoorSide(panels, door, doorEdge, openingSegments)
      if (!fixed) {
        placementIssues.push(`${sku}: со стороны петель нет неподвижного стекла для ответных отверстий`)
        return
      }
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
      const doorEdge = getDoorHingeEdge(panels, door, doorPlacements)
      const fixed = getFixedOnDoorSide(panels, door, doorEdge, openingSegments)
      if (!fixed) {
        placementIssues.push(`${sku}: со стороны петель нет неподвижного стекла для ответной части`)
        return
      }
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
    const placements = connectorPlacements.filter((placement) => placement.hardwareItemId === component.item.id)
    placements.forEach((placement) => {
      if (placement.mountType === 'profile') return
      const panel = panels[placement.panelIndex]
      if (!panel || panel.role !== 'fixed') return
      spacedPositions(placement.verticalCount, panel.heightMm, 140).forEach((center, connectorIndex) => {
        addEdgeCut(panel, component, template, 'notch', `${sku}: вертикальный коннектор ${connectorIndex + 1}, R10`, placement.verticalEdge, center, 32, 20, 10, 'round-slot', 22)
      })
      spacedPositions(placement.horizontalCount, panel.widthMm, 140).forEach((center, connectorIndex) => {
        addEdgeCut(panel, component, template, 'notch', `${sku}: горизонтальный коннектор ${connectorIndex + 1}, R10`, placement.horizontalEdge, center, 32, 20, 10, 'round-slot', 22)
      })
    })
    return
  }

  if (pattern === 'corner-connector-fdk24') {
    const pair = fixedPanels.slice(0, 2)
    if (pair.length < 2) {
      placementIssues.push(`${sku}: коннектор требует два неподвижных стекла; на дверь он не устанавливается`)
      return
    }
    spacedPositions(component.quantity, Math.min(pair[0].heightMm, pair[1].heightMm), 140).forEach((center, index) => {
      addHole(pair[0], component, template, `${sku}: коннектор ${index + 1}, отверстие`, edgeX(pair[0], 'right', 32), center, 20)
      addEdgeCut(pair[1], component, template, 'notch', `${sku}: коннектор ${index + 1}, ответный вырез R10`, 'left', center, 32, 20, 10, 'round-slot', 22)
    })
    return
  }

  if (pattern === 'glass-connector-fdk28') {
    const pairs: Array<readonly [ProductionPanel, ProductionPanel]> = []
    fixedPanels.forEach((panel, index) => {
      const next = fixedPanels[index + 1]
      if (next) pairs.push([panel, next])
    })
    if (pairs.length === 0) {
      placementIssues.push(`${sku}: коннектор требует стык двух неподвижных стекол; дверная створка исключена`)
      return
    }
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
      const edge = oppositeEdge(getDoorHingeEdge(panels, door, doorPlacements))
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
  designOverrides?: ProductionDesignOverrides,
): ProductionPackage => {
  const construction = getConstruction(catalog, form.constructionId)
  const glass = getOption(catalog.glass, form.glassId)
  const hardware = getOption(catalog.hardware, form.hardwareId)
  const hardwareClass = getOption(catalog.hardwareClass, form.hardwareClassId)
  const glassThickness = glass.thickness ?? 8
  const components = getConstructionHardwareComponents(catalog, construction, glassThickness)
  const { panels, openingHeightMm, openingSegments } = getPanelDefaults(catalog, form, designOverrides?.opening)
  const resolvedChecks = components.map((component) => ({
    component,
    ...createTemplateCheck(component, glassThickness),
  }))
  const placementIssues: string[] = []
  const doorPlacements = createDoorPlacements(panels, openingSegments, construction.sketch, resolvedChecks, designOverrides?.doors)
  const connectorPlacements = createConnectorPlacements(resolvedChecks, panels, designOverrides?.connectors)
  const magneticPlacements = createMagneticPlacements(
    resolvedChecks,
    panels,
    doorPlacements,
    construction.sketch,
    openingSegments,
    placementIssues,
    designOverrides?.magnetic,
  )

  applyVerifiedClearances(resolvedChecks, panels, magneticPlacements, doorPlacements)

  resolvedChecks.forEach(({ component, template, check }) => {
    if (!template || check.status !== 'verified') return
    if (template.pattern !== 'none') applyMachiningPattern(template.pattern, component, template, panels, placementIssues, connectorPlacements, doorPlacements, openingSegments)
  })

  const purchases = components.map((component) => {
    const matchingConnectors = connectorPlacements.filter((placement) => placement.hardwareItemId === component.item.id)
    const matchingMagnets = magneticPlacements.filter((placement) => placement.hardwareItemId === component.item.id)
    const quantity = matchingConnectors.length > 0
      ? matchingConnectors
        .filter((placement) => placement.mountType === 'connectors')
        .reduce((total, placement) => total + placement.verticalCount + placement.horizontalCount, 0)
      : matchingMagnets.length > 0 ? matchingMagnets.length : component.quantity
    return {
      id: crypto.randomUUID(),
      hardwareItemId: component.item.id,
      label: component.item.label,
      sku: component.item.sku ?? '',
      quantity,
      sourceUrl: component.item.sourceUrl,
    }
  }).filter((item) => item.quantity > 0)
  connectorPlacements.forEach((placement) => {
    if (placement.mountType !== 'profile' || !placement.profileHardwareItemId) return
    const item = catalog.hardwareItems.find((entry) => entry.id === placement.profileHardwareItemId)
    if (!item) return
    const existing = purchases.find((entry) => entry.hardwareItemId === item.id)
    if (existing) existing.quantity += 1
    else purchases.push({
      id: crypto.randomUUID(),
      hardwareItemId: item.id,
      label: item.label,
      sku: item.sku ?? '',
      quantity: 1,
      sourceUrl: item.sourceUrl,
    })
  })
  const cuts = components.flatMap((component) => {
    if (!isCutMaterial(component.item.label, component.item.sectionId)) return []
    const cutLengthMm = getCutLengthMm(component.item.label, form, openingSegments, openingHeightMm)
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
  connectorPlacements.forEach((placement) => {
    if (placement.mountType !== 'profile' || !placement.profileHardwareItemId) return
    const item = catalog.hardwareItems.find((entry) => entry.id === placement.profileHardwareItemId)
    if (!item) return
    const cutLengthMm = openingHeightMm
    const stockLengthMm = inferStockLengthMm(item.label)
    cuts.push({
      id: crypto.randomUUID(),
      hardwareItemId: item.id,
      label: item.label,
      sku: item.sku ?? '',
      quantity: 1,
      cutLengthMm,
      stockLengthMm,
      stockPieces: Math.ceil(cutLengthMm / stockLengthMm),
      sourceUrl: item.sourceUrl,
    })
  })
  const templateChecks = resolvedChecks.map(({ check }) => {
    const allPlacements = connectorPlacements.filter((placement) => placement.hardwareItemId === check.hardwareItemId)
    const placements = allPlacements.filter((placement) => placement.mountType === 'connectors')
    if (allPlacements.length > 0 && placements.length === 0) return {
      ...check,
      quantity: 0,
      status: 'not-required' as const,
      message: 'Коннекторы заменены опорным профилем',
    }
    if (placements.length === 0) return check
    return {
      ...check,
      quantity: placements.reduce((total, placement) => total + placement.verticalCount + placement.horizontalCount, 0),
    }
  })
  const blockingIssues = templateChecks
    .filter((check) => check.status === 'missing' || check.status === 'incompatible')
    .map((check) => `${check.sku || check.label}: ${check.message}`)
    .concat(placementIssues)

  return {
    quoteNumber,
    itemIndex,
    constructionTitle: construction.title,
    constructionSketch: construction.sketch,
    glassLabel: glass.label,
    glassThickness,
    hardwareColor: hardware.label,
    hardwareClass: hardwareClass.label,
    openingHeightMm,
    openingSegments,
    panels,
    doorPlacements,
    connectorPlacements,
    magneticPlacements,
    cuts,
    purchases,
    templateChecks,
    warnings: [
      'Контуры отверстий и вырезов построены автоматически по монтажным чертежам выбранных артикулов.',
      'Чистовые размеры стекол рассчитаны из размеров проёма с учётом подтверждённых зазоров и перехлёстов.',
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
