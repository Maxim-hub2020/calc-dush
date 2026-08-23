import type {
  ProductionOperation,
  ProductionOperationEdge,
  ProductionPackage,
  ProductionPanel,
} from './productionPlanning'

type Point = { x: number; y: number }

const number = (value: number) => String(Math.round(value * 1000) / 1000)
const pair = (code: number, value: string | number) => `${code}\n${value}`

const line = (layer: string, start: Point, end: Point) => [
  pair(0, 'LINE'), pair(8, layer),
  pair(10, number(start.x)), pair(20, number(start.y)), pair(30, 0),
  pair(11, number(end.x)), pair(21, number(end.y)), pair(31, 0),
].join('\n')

const circle = (layer: string, center: Point, radius: number) => [
  pair(0, 'CIRCLE'), pair(8, layer),
  pair(10, number(center.x)), pair(20, number(center.y)), pair(30, 0),
  pair(40, number(radius)),
].join('\n')

const normalizedAngle = (value: number) => ((value * 180 / Math.PI) % 360 + 360) % 360

const arc = (layer: string, center: Point, radius: number, startAngle: number, endAngle: number) => [
  pair(0, 'ARC'), pair(8, layer),
  pair(10, number(center.x)), pair(20, number(center.y)), pair(30, 0),
  pair(40, number(radius)), pair(50, number(startAngle)), pair(51, number(endAngle)),
].join('\n')

const textEntity = (layer: string, point: Point, height: number, value: string) => [
  pair(0, 'TEXT'), pair(8, layer),
  pair(10, number(point.x)), pair(20, number(point.y)), pair(30, 0),
  pair(40, number(height)), pair(1, value.replace(/[^\x20-\x7E]/g, ' ')),
].join('\n')

const add = (point: Point, vector: Point, factor = 1): Point => ({
  x: point.x + vector.x * factor,
  y: point.y + vector.y * factor,
})

const angleOf = (vector: Point) => normalizedAngle(Math.atan2(vector.y, vector.x))

const shortArcAngles = (first: Point, second: Point) => {
  const firstAngle = angleOf(first)
  const secondAngle = angleOf(second)
  const ccw = (secondAngle - firstAngle + 360) % 360
  return ccw <= 180
    ? { start: firstAngle, end: secondAngle }
    : { start: secondAngle, end: firstAngle }
}

const edgeGeometry = (
  panel: ProductionPanel,
  edge: Extract<ProductionOperationEdge, 'left' | 'right'>,
  originX: number,
) => {
  const inset = panel.shape === 'trapezoid'
    ? Math.max(0, (panel.widthMm - panel.topWidthMm) / 2)
    : 0
  const bottom: Point = { x: originX + (edge === 'left' ? 0 : panel.widthMm), y: 0 }
  const top: Point = {
    x: originX + (edge === 'left' ? inset : panel.widthMm - inset),
    y: panel.heightMm,
  }
  const dx = top.x - bottom.x
  const dy = top.y - bottom.y
  const length = Math.hypot(dx, dy) || 1
  const tangent = { x: dx / length, y: dy / length }
  const normal = edge === 'left'
    ? { x: tangent.y, y: -tangent.x }
    : { x: -tangent.y, y: tangent.x }
  const pointAtY = (yMm: number): Point => ({
    x: bottom.x + dx * Math.max(0, Math.min(1, yMm / Math.max(1, panel.heightMm))),
    y: Math.max(0, Math.min(panel.heightMm, yMm)),
  })
  return { bottom, top, tangent, normal, pointAtY }
}

const horizontalEdgeGeometry = (
  panel: ProductionPanel,
  edge: Extract<ProductionOperationEdge, 'top' | 'bottom'>,
  originX: number,
) => {
  const inset = panel.shape === 'trapezoid'
    ? Math.max(0, (panel.widthMm - panel.topWidthMm) / 2)
    : 0
  const left: Point = {
    x: originX + (edge === 'top' ? inset : 0),
    y: edge === 'top' ? panel.heightMm : 0,
  }
  const right: Point = {
    x: originX + (edge === 'top' ? panel.widthMm - inset : panel.widthMm),
    y: edge === 'top' ? panel.heightMm : 0,
  }
  const length = Math.max(1, right.x - left.x)
  const tangent = { x: 1, y: 0 }
  const normal = edge === 'bottom' ? { x: 0, y: 1 } : { x: 0, y: -1 }
  const pointAtX = (xMm: number): Point => ({
    x: left.x + Math.max(0, Math.min(length, xMm - (edge === 'top' ? inset : 0))),
    y: left.y,
  })
  return { left, right, tangent, normal, pointAtX }
}

const edgeCutEntities = (
  operation: ProductionOperation,
  panel: ProductionPanel,
  originX: number,
  layer: string,
) => {
  const edge = operation.edge ?? (operation.xMm <= panel.widthMm / 2 ? 'left' : 'right')
  const geometry = edge === 'top' || edge === 'bottom'
    ? horizontalEdgeGeometry(panel, edge, originX)
    : edgeGeometry(panel, edge, originX)
  const center = edge === 'top' || edge === 'bottom'
    ? (geometry as ReturnType<typeof horizontalEdgeGeometry>).pointAtX(operation.xMm)
    : (geometry as ReturnType<typeof edgeGeometry>).pointAtY(operation.yMm)
  const halfOpening = operation.heightMm / 2
  const edgeTop = add(center, geometry.tangent, halfOpening)
  const edgeBottom = add(center, geometry.tangent, -halfOpening)
  const straightTop = add(edgeTop, geometry.normal, operation.straightDepthMm)
  const straightBottom = add(edgeBottom, geometry.normal, operation.straightDepthMm)
  const entities = [line(layer, edgeTop, straightTop), line(layer, edgeBottom, straightBottom)]

  if (operation.profile === 'round-slot') {
    const arcCenter = add(center, geometry.normal, operation.straightDepthMm)
    const start = angleOf({ x: -geometry.tangent.x, y: -geometry.tangent.y })
    const end = angleOf(geometry.tangent)
    const normalAngle = angleOf(geometry.normal)
    const ccwIncludesNormal = (normalAngle - start + 360) % 360 <= (end - start + 360) % 360
    entities.push(arc(
      layer,
      arcCenter,
      operation.radiusMm,
      ccwIncludesNormal ? start : end,
      ccwIncludesNormal ? end : start,
    ))
    return entities
  }

  const topCenter = add(straightTop, geometry.tangent, -operation.radiusMm)
  const bottomCenter = add(straightBottom, geometry.tangent, operation.radiusMm)
  const deepTop = add(topCenter, geometry.normal, operation.radiusMm)
  const deepBottom = add(bottomCenter, geometry.normal, operation.radiusMm)
  const topAngles = shortArcAngles(geometry.tangent, geometry.normal)
  const bottomAngles = shortArcAngles({ x: -geometry.tangent.x, y: -geometry.tangent.y }, geometry.normal)
  entities.push(
    arc(layer, topCenter, operation.radiusMm, topAngles.start, topAngles.end),
    line(layer, deepTop, deepBottom),
    arc(layer, bottomCenter, operation.radiusMm, bottomAngles.start, bottomAngles.end),
  )
  return entities
}

const perimeterEdgeEntities = (
  panel: ProductionPanel,
  edge: Extract<ProductionOperationEdge, 'left' | 'right'>,
  originX: number,
  layer: string,
) => {
  const geometry = edgeGeometry(panel, edge, originX)
  const openings = panel.operations
    .filter((operation) => operation.kind !== 'hole' && operation.edge === edge)
    .map((operation) => ({
      bottom: Math.max(0, operation.yMm - operation.heightMm / 2),
      top: Math.min(panel.heightMm, operation.yMm + operation.heightMm / 2),
    }))
    .sort((left, right) => left.bottom - right.bottom)
  const entities: string[] = []
  let cursor = 0
  openings.forEach((opening) => {
    if (opening.bottom > cursor) entities.push(line(layer, geometry.pointAtY(cursor), geometry.pointAtY(opening.bottom)))
    cursor = Math.max(cursor, opening.top)
  })
  if (cursor < panel.heightMm) entities.push(line(layer, geometry.pointAtY(cursor), geometry.pointAtY(panel.heightMm)))
  return entities
}

const perimeterHorizontalEntities = (
  panel: ProductionPanel,
  edge: Extract<ProductionOperationEdge, 'top' | 'bottom'>,
  originX: number,
  layer: string,
) => {
  const geometry = horizontalEdgeGeometry(panel, edge, originX)
  const inset = panel.shape === 'trapezoid' && edge === 'top'
    ? Math.max(0, (panel.widthMm - panel.topWidthMm) / 2)
    : 0
  const edgeLength = edge === 'top' ? panel.topWidthMm : panel.widthMm
  const openings = panel.operations
    .filter((operation) => operation.kind !== 'hole' && operation.edge === edge)
    .map((operation) => ({
      left: Math.max(0, operation.xMm - inset - operation.heightMm / 2),
      right: Math.min(edgeLength, operation.xMm - inset + operation.heightMm / 2),
    }))
    .sort((left, right) => left.left - right.left)
  const pointAtDistance = (distance: number) => add(geometry.left, geometry.tangent, distance)
  const entities: string[] = []
  let cursor = 0
  openings.forEach((opening) => {
    if (opening.left > cursor) entities.push(line(layer, pointAtDistance(cursor), pointAtDistance(opening.left)))
    cursor = Math.max(cursor, opening.right)
  })
  if (cursor < edgeLength) entities.push(line(layer, pointAtDistance(cursor), pointAtDistance(edgeLength)))
  return entities
}

const panelEntities = (panel: ProductionPanel, panelIndex: number, originX: number) => {
  const glassLayer = `GLASS_${panelIndex + 1}`
  const machiningLayer = `CUT_${panelIndex + 1}`
  const entities = [
    ...perimeterHorizontalEntities(panel, 'bottom', originX, glassLayer),
    ...perimeterHorizontalEntities(panel, 'top', originX, glassLayer),
    ...perimeterEdgeEntities(panel, 'left', originX, glassLayer),
    ...perimeterEdgeEntities(panel, 'right', originX, glassLayer),
  ]
  panel.operations.forEach((operation) => {
    if (operation.kind === 'hole') {
      entities.push(circle(machiningLayer, { x: originX + operation.xMm, y: operation.yMm }, operation.diameterMm / 2))
    } else {
      entities.push(...edgeCutEntities(operation, panel, originX, machiningLayer))
    }
  })
  entities.push(textEntity('LABELS', { x: originX, y: panel.heightMm + 45 }, 24, `GLASS ${panelIndex + 1}  ${number(panel.widthMm)}x${number(panel.heightMm)} MM`))
  return entities
}

const layerTable = (draft: ProductionPackage) => {
  const layers = [
    { name: 'LABELS', color: 8 },
    ...draft.panels.flatMap((_, index) => [
      { name: `GLASS_${index + 1}`, color: 7 },
      { name: `CUT_${index + 1}`, color: 1 },
    ]),
  ]
  return [
    pair(0, 'TABLE'), pair(2, 'LAYER'), pair(70, layers.length),
    ...layers.flatMap((layer) => [
      pair(0, 'LAYER'), pair(2, layer.name), pair(70, 0), pair(62, layer.color), pair(6, 'CONTINUOUS'),
    ]),
    pair(0, 'ENDTAB'),
  ].join('\n')
}

export const createProductionDxfText = (draft: ProductionPackage) => {
  let originX = 0
  const entities = draft.panels.flatMap((panel, index) => {
    const result = panelEntities(panel, index, originX)
    originX += panel.widthMm + 200
    return result
  })
  return [
    pair(0, 'SECTION'), pair(2, 'HEADER'),
    pair(9, '$ACADVER'), pair(1, 'AC1015'),
    pair(9, '$INSUNITS'), pair(70, 4),
    pair(0, 'ENDSEC'),
    pair(0, 'SECTION'), pair(2, 'TABLES'), layerTable(draft), pair(0, 'ENDSEC'),
    pair(0, 'SECTION'), pair(2, 'ENTITIES'),
    pair(999, 'UNITS: MILLIMETERS. GEOMETRY SCALE 1:1.'),
    ...entities,
    pair(0, 'ENDSEC'), pair(0, 'EOF'),
  ].join('\n')
}

export const createProductionDxfBlob = (draft: ProductionPackage) => new Blob(
  [createProductionDxfText(draft)],
  { type: 'application/dxf;charset=us-ascii' },
)
