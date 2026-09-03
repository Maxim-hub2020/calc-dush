import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileDown,
  LoaderCircle,
  Minus,
  PackageCheck,
  Plus,
  Ruler,
  Scissors,
  ShieldCheck,
  X,
} from 'lucide-react'
import {
  calculateQuote,
  getConstruction,
  getConstructionHardwareComponents,
  getOption,
  type CalculatorForm,
} from './calculator'
import { inferHardwareItemGlassThickness, type PricingCatalog } from './pricing'
import {
  createProductionPackage,
  getProductionValidationErrors,
  type ProductionConnectorPlacement,
  type ProductionDesignOverrides,
  type ProductionDoorPlacement,
  type ProductionMagneticPlacement,
  type ProductionOperation,
  type ProductionPanel,
  type ProductionTemplateStatus,
} from './productionPlanning'
import { shareProductionPdf, type ProductionPdfPreview } from './productionPdf'
import { ProductionAssemblyPreview } from './ProductionAssemblyPreview'
import './ProductionWorkspace.css'

type ProductionWorkspaceProps = {
  catalog: PricingCatalog
  form: CalculatorForm
  itemIndex: number
  quoteNumber: string
  onClose: () => void
  onFormChange: (form: CalculatorForm) => void
  onPreview: (preview: ProductionPdfPreview) => void
}

const statusLabels: Record<ProductionTemplateStatus, string> = {
  verified: 'Чертёж проверен',
  'not-required': 'Без обработки',
  missing: 'Нет шаблона',
  incompatible: 'Не подходит',
}

const operationKindLabels: Record<ProductionOperation['kind'], string> = {
  hole: 'Отверстие',
  notch: 'Паз',
  cutout: 'Вырез',
  template: 'По шаблону',
}

const hingeJointLabels: Record<ProductionDoorPlacement['hingeJointType'], string> = {
  none: 'Без петель',
  wall: 'Стена-стекло',
  'glass-180': 'Стекло-стекло 180°',
  'glass-90': 'Стекло-стекло 90°',
  'glass-135': 'Стекло-стекло 135°',
  invalid: 'Недопустимая опора',
}

const formatMm = (value: number) => `${Math.round(value)} мм`
const formatSignedMm = (value: number) => `${value > 0 ? '+' : ''}${Math.round(value)} мм`

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, Math.round(value) || minimum))

const miniatureEdgeCutPath = (
  operation: ProductionOperation,
  left: number,
  top: number,
  drawWidth: number,
  drawHeight: number,
  scale: number,
) => {
  if (operation.edge === 'top' || operation.edge === 'bottom') {
    const centerX = left + operation.xMm * scale
    const edgeY = operation.edge === 'top' ? top : top + drawHeight
    const direction = operation.edge === 'top' ? 1 : -1
    const depth = operation.widthMm * scale
    const halfOpening = operation.heightMm * scale / 2
    const radius = operation.radiusMm * scale
    const straight = operation.straightDepthMm * scale
    const sweep = operation.edge === 'top' ? 0 : 1
    if (operation.profile === 'hinge-cutout') {
      return `M ${centerX - halfOpening} ${edgeY} V ${edgeY + direction * straight} A ${radius} ${radius} 0 0 ${sweep} ${centerX - halfOpening + radius} ${edgeY + direction * depth} H ${centerX + halfOpening - radius} A ${radius} ${radius} 0 0 ${sweep} ${centerX + halfOpening} ${edgeY + direction * straight} V ${edgeY} Z`
    }
    return `M ${centerX - halfOpening} ${edgeY} V ${edgeY + direction * straight} A ${radius} ${radius} 0 0 ${sweep} ${centerX} ${edgeY + direction * depth} A ${radius} ${radius} 0 0 ${sweep} ${centerX + halfOpening} ${edgeY + direction * straight} V ${edgeY} Z`
  }
  const centerY = top + drawHeight - operation.yMm * scale
  const depth = operation.widthMm * scale
  const halfOpening = operation.heightMm * scale / 2
  const radius = operation.radiusMm * scale
  const straight = operation.straightDepthMm * scale
  const right = operation.edge === 'right'
  const edgeX = right ? left + drawWidth : left
  const direction = right ? -1 : 1
  const sweep = right ? 0 : 1
  if (operation.profile === 'hinge-cutout') {
    return `M ${edgeX} ${centerY - halfOpening} H ${edgeX + direction * straight} A ${radius} ${radius} 0 0 ${sweep} ${edgeX + direction * depth} ${centerY - halfOpening + radius} V ${centerY + halfOpening - radius} A ${radius} ${radius} 0 0 ${sweep} ${edgeX + direction * straight} ${centerY + halfOpening} H ${edgeX} Z`
  }
  return `M ${edgeX} ${centerY - halfOpening} H ${edgeX + direction * straight} A ${radius} ${radius} 0 0 ${sweep} ${edgeX + direction * depth} ${centerY} A ${radius} ${radius} 0 0 ${sweep} ${edgeX + direction * straight} ${centerY + halfOpening} H ${edgeX} Z`
}

function PanelMiniature({ panel }: { panel: ProductionPanel }) {
  const width = Math.max(1, panel.widthMm)
  const height = Math.max(1, panel.heightMm)
  const viewWidth = 150
  const viewHeight = 170
  const scale = Math.min(115 / width, 135 / height)
  const drawWidth = width * scale
  const drawHeight = height * scale
  const left = (viewWidth - drawWidth) / 2
  const top = (viewHeight - drawHeight) / 2
  return (
    <svg aria-label={`Схема ${panel.label}`} className="production-panel-miniature" viewBox={`0 0 ${viewWidth} ${viewHeight}`}>
      <rect fill="#eff6ff" height={drawHeight} rx="2" stroke="#1d4ed8" strokeWidth="1.5" width={drawWidth} x={left} y={top} />
      {panel.operations.map((operation) => {
        const cx = left + operation.xMm * scale
        const cy = top + drawHeight - operation.yMm * scale
        if (operation.kind === 'hole') {
          return <circle cx={cx} cy={cy} fill="#fff" key={operation.id} r={Math.max(2.5, operation.diameterMm * scale / 2)} stroke="#dc2626" strokeWidth="1.5" />
        }
        return (
          <path
            d={miniatureEdgeCutPath(operation, left, top, drawWidth, drawHeight, scale)}
            fill="#fff7ed"
            key={operation.id}
            stroke="#c2410c"
            strokeWidth="1.5"
          />
        )
      })}
      <text fill="#64748b" fontSize="8.5" textAnchor="middle" x={viewWidth / 2} y={viewHeight - 12}>Стекло {Math.round(width)} × {Math.round(height)}</text>
      <text fill="#2563eb" fontSize="8.5" fontWeight="700" textAnchor="middle" x={viewWidth / 2} y={viewHeight - 2}>Участок {Math.round(panel.openingWidthMm)} × {Math.round(panel.openingHeightMm)}</text>
    </svg>
  )
}

type CountStepperProps = {
  label: string
  maximum: number
  value: number
  onChange: (value: number) => void
}

function CountStepper({ label, maximum, value, onChange }: CountStepperProps) {
  return (
    <div className="production-count-stepper">
      <span>{label}</span>
      <div>
        <button aria-label={`Уменьшить: ${label}`} disabled={value <= 0} title="Уменьшить" type="button" onClick={() => onChange(Math.max(0, value - 1))}><Minus size={15} /></button>
        <strong>{value}</strong>
        <button aria-label={`Увеличить: ${label}`} disabled={value >= maximum} title="Увеличить" type="button" onClick={() => onChange(Math.min(maximum, value + 1))}><Plus size={15} /></button>
      </div>
    </div>
  )
}

const planSegments = (draft: ReturnType<typeof createProductionPackage>) => {
  const count = Math.max(1, draft.panels.length)
  if (draft.constructionSketch === 'trapezoid') {
    return [
      { x1: 80, y1: 190, x2: 190, y2: 70 },
      { x1: 190, y1: 70, x2: 430, y2: 70 },
      { x1: 430, y1: 70, x2: 540, y2: 190 },
    ].slice(0, count)
  }
  if (['corner', 'corner-plus', 'double-corner', 'slider-corner', 'slider-double'].includes(draft.constructionSketch)) {
    const result = Array.from({ length: count }, () => ({ x1: 0, y1: 0, x2: 0, y2: 0 }))
    const firstIndexes = draft.openingSegments[0]?.panelIndexes ?? [0]
    const secondIndexes = draft.openingSegments[1]?.panelIndexes ?? []
    firstIndexes.forEach((panelIndex, position) => {
      result[panelIndex] = {
        x1: 70 + position * (250 / firstIndexes.length),
        y1: 190,
        x2: 70 + (position + 1) * (250 / firstIndexes.length),
        y2: 190,
      }
    })
    secondIndexes.forEach((panelIndex, position) => {
      result[panelIndex] = {
        x1: 320,
        y1: 190 - position * (120 / Math.max(1, secondIndexes.length)),
        x2: 320,
        y2: 190 - (position + 1) * (120 / Math.max(1, secondIndexes.length)),
      }
    })
    return result
  }
  return Array.from({ length: count }, (_, index) => ({
    x1: 70 + index * (470 / count),
    y1: 125,
    x2: 70 + (index + 1) * (470 / count),
    y2: 125,
  }))
}

type PlanEditor = { kind: 'connector' | 'magnetic'; id: string } | null

type ProductionPlanViewProps = {
  catalog: PricingCatalog
  draft: ReturnType<typeof createProductionPackage>
  onConnector: (placement: ProductionConnectorPlacement, patch: Partial<ProductionConnectorPlacement>) => void
  onDoor: (placement: ProductionDoorPlacement, patch: Partial<ProductionDoorPlacement>) => void
  onMagnetic: (placement: ProductionMagneticPlacement, patch: Partial<ProductionMagneticPlacement>) => void
}

const segmentEndpoint = (
  segment: { x1: number; y1: number; x2: number; y2: number },
  edge: 'left' | 'right',
) => edge === 'left' ? { x: segment.x1, y: segment.y1 } : { x: segment.x2, y: segment.y2 }

const magneticJointLabel = (placement: ProductionMagneticPlacement) => {
  if (placement.jointType === 'corner-90') return 'Угловой стык 90°'
  if (placement.jointType === 'corner-135') return 'Угловой стык 135°'
  if (placement.jointType === 'inline-180') return 'Прямой стык 180°'
  if (placement.jointType === 'wall-strike') return 'Притвор к стене'
  return 'Кромки не сходятся'
}

function ProductionPlanView({ catalog, draft, onConnector, onDoor, onMagnetic }: ProductionPlanViewProps) {
  const [editor, setEditor] = useState<PlanEditor>(null)
  const segments = planSegments(draft)
  const connectorByPanel = new Map(draft.connectorPlacements.map((placement) => [placement.panelIndex, placement]))
  const activeConnector = editor?.kind === 'connector' ? draft.connectorPlacements.find((placement) => placement.id === editor.id) : undefined
  const activeMagnetic = editor?.kind === 'magnetic' ? draft.magneticPlacements.find((placement) => placement.id === editor.id) : undefined
  const profileOptions = catalog.hardwareItems
    .filter((item) => {
      if (item.sectionId !== 'support-profiles' || !/^профиль(?:\s|$)/i.test(item.label) || !/(для стекла|опорн|п-образн)/i.test(item.label) || /заглуш|декоратив|магнит|имитац|уплотнител/i.test(item.label)) return false
      const explicitThickness = item.label.match(/(?:стекл[ао]|под стекло)\s*(6|8|10|12)\s*мм/i)
      if (explicitThickness && Number(explicitThickness[1]) !== draft.glassThickness) return false
      const thickness = inferHardwareItemGlassThickness(item)
      return thickness === undefined || thickness === draft.glassThickness
    })
    .sort((a, b) => (a.price || Number.MAX_SAFE_INTEGER) - (b.price || Number.MAX_SAFE_INTEGER))
  const openingDimensions = draft.openingSegments.flatMap((opening, openingIndex) => {
    const first = segments[opening.panelIndexes[0]]
    const last = segments[opening.panelIndexes.at(-1) ?? -1]
    if (!first || !last) return []
    const x1 = first.x1
    const y1 = first.y1
    const x2 = last.x2
    const y2 = last.y2
    const length = Math.hypot(x2 - x1, y2 - y1) || 1
    const normalX = -(y2 - y1) / length
    const normalY = (x2 - x1) / length
    const offset = draft.constructionSketch === 'trapezoid' ? 34 : 31 + openingIndex * 5
    return [{ ...opening, x1, y1, x2, y2, normalX, normalY, offset }]
  })
  return (
    <div className="production-plan-interactive">
      <svg aria-label="Интерактивная схема душевой сверху" className="production-plan-svg" viewBox="0 0 610 260">
        <rect fill="#f8fafc" height="260" width="610" />
        <path d="M35 225 H575" fill="none" stroke="#cbd5e1" strokeDasharray="7 6" strokeWidth="2" />
        {segments.map((segment, index) => (
          <g key={`curb-${draft.panels[index]?.id ?? index}`}>
            <line stroke="#cbd5e1" strokeLinecap="round" strokeWidth="25" x1={segment.x1} x2={segment.x2} y1={segment.y1} y2={segment.y2} />
            <line stroke="#f8fafc" strokeLinecap="round" strokeWidth="21" x1={segment.x1} x2={segment.x2} y1={segment.y1} y2={segment.y2} />
          </g>
        ))}
        {segments.map((segment, index) => {
          const panel = draft.panels[index]
          if (!panel) return null
          const middleX = (segment.x1 + segment.x2) / 2
          const middleY = (segment.y1 + segment.y2) / 2
          const connector = connectorByPanel.get(index)
          const length = Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) || 1
          const normalX = -(segment.y2 - segment.y1) / length
          const normalY = (segment.x2 - segment.x1) / length
          const hardwareX = middleX - normalX * 23
          const hardwareY = middleY - normalY * 23
          return (
            <g key={panel.id}>
              <line stroke={panel.role === 'door' ? '#f59e0b' : '#2563eb'} strokeLinecap="round" strokeWidth="9" x1={segment.x1} x2={segment.x2} y1={segment.y1} y2={segment.y2} />
              <circle cx={middleX} cy={middleY} fill="#fff" r="12" stroke="#0f172a" strokeWidth="1.2" />
              <text fill="#0f172a" fontSize="11" fontWeight="800" pointerEvents="none" textAnchor="middle" x={middleX} y={middleY + 4}>{index + 1}</text>
              {connector ? (
                <g
                  aria-label={`Изменить крепление ${panel.label}`}
                  className="production-plan-control"
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditor({ kind: 'connector', id: connector.id })}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setEditor({ kind: 'connector', id: connector.id }) }}
                >
                  <title>{connector.mountType === 'profile' ? 'Опорный профиль' : `${connector.verticalCount} вертикальных и ${connector.horizontalCount} горизонтальных коннектора`}. Нажмите для изменения.</title>
                  <rect fill="#fff" height="22" rx="5" stroke="#93c5fd" width="58" x={hardwareX - 29} y={hardwareY - 11} />
                  <text fill="#1d4ed8" fontSize="9.5" fontWeight="800" textAnchor="middle" x={hardwareX} y={hardwareY + 3}>{connector.mountType === 'profile' ? 'ПРОФИЛЬ' : `К ${connector.verticalCount}+${connector.horizontalCount}`}</text>
                </g>
              ) : null}
            </g>
          )
        })}
        {openingDimensions.map((opening) => {
          const dx1 = opening.x1 + opening.normalX * opening.offset
          const dy1 = opening.y1 + opening.normalY * opening.offset
          const dx2 = opening.x2 + opening.normalX * opening.offset
          const dy2 = opening.y2 + opening.normalY * opening.offset
          let angle = Math.atan2(dy2 - dy1, dx2 - dx1) * 180 / Math.PI
          if (angle > 90) angle -= 180
          if (angle < -90) angle += 180
          const labelX = (dx1 + dx2) / 2 + opening.normalX * 13
          const labelY = (dy1 + dy2) / 2 + opening.normalY * 13
          return (
            <g key={opening.id}>
              <line stroke="#94a3b8" strokeWidth="1" x1={opening.x1} x2={dx1} y1={opening.y1} y2={dy1} />
              <line stroke="#94a3b8" strokeWidth="1" x1={opening.x2} x2={dx2} y1={opening.y2} y2={dy2} />
              <line markerEnd="url(#production-plan-arrow)" markerStart="url(#production-plan-arrow)" stroke="#0f172a" strokeWidth="1" x1={dx1} x2={dx2} y1={dy1} y2={dy2} />
              <text fill="#0f172a" fontSize="9.5" fontWeight="800" paintOrder="stroke" stroke="#f8fafc" strokeWidth="5" textAnchor="middle" transform={`rotate(${angle} ${labelX} ${labelY})`} x={labelX} y={labelY + 3}>{opening.label}: {Math.round(opening.lengthMm)} мм</text>
            </g>
          )
        })}
        {draft.doorPlacements.map((door) => {
          const segment = segments[door.panelIndex]
          if (!segment) return null
          if (door.motionType === 'sliding') {
            const dx = segment.x2 - segment.x1
            const dy = segment.y2 - segment.y1
            const length = Math.hypot(dx, dy) || 1
            const centerX = (segment.x1 + segment.x2) / 2
            const centerY = (segment.y1 + segment.y2) / 2
            const direction = door.hingeEdge === 'left' ? -1 : 1
            const slideX = centerX + direction * dx / length * Math.min(58, length * 0.34)
            const slideY = centerY + direction * dy / length * Math.min(58, length * 0.34)
            return (
              <g key={door.id}>
                <line markerEnd="url(#production-swing-arrow)" pointerEvents="none" stroke="#d97706" strokeDasharray="5 4" strokeWidth="3" x1={centerX} x2={slideX} y1={centerY} y2={slideY} />
                {(['left', 'right'] as const).map((edge) => {
                  const x = edge === 'left' ? segment.x1 : segment.x2
                  const y = edge === 'left' ? segment.y1 : segment.y2
                  const normalX = -(segment.y2 - segment.y1) / length
                  const normalY = (segment.x2 - segment.x1) / length
                  const controlX = x - normalX * 13
                  const controlY = y - normalY * 13
                  const selected = edge === door.hingeEdge
                  return (
                    <g aria-label={`${door.panelLabel}: нахлёст ${edge === 'left' ? 'слева' : 'справа'}`} className="production-plan-control" key={edge} role="button" tabIndex={0} onClick={() => onDoor(door, { hingeEdge: edge })} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onDoor(door, { hingeEdge: edge }) }}>
                      <title>Расположить нахлёст {edge === 'left' ? 'слева' : 'справа'}</title>
                      <line pointerEvents="none" stroke="#d97706" strokeWidth="1" x1={x} x2={controlX} y1={y} y2={controlY} />
                      <circle cx={controlX} cy={controlY} fill={selected ? '#d97706' : '#fff'} r={selected ? 11 : 6} stroke="#d97706" strokeWidth="2" />
                      {selected ? <text fill="#fff" fontSize="7" fontWeight="900" pointerEvents="none" textAnchor="middle" x={controlX} y={controlY + 2.5}>+50</text> : null}
                    </g>
                  )
                })}
              </g>
            )
          }
          const hingeX = door.hingeEdge === 'left' ? segment.x1 : segment.x2
          const hingeY = door.hingeEdge === 'left' ? segment.y1 : segment.y2
          const vx = door.hingeEdge === 'left' ? segment.x2 - segment.x1 : segment.x1 - segment.x2
          const vy = door.hingeEdge === 'left' ? segment.y2 - segment.y1 : segment.y1 - segment.y2
          const length = Math.hypot(vx, vy) || 1
          const radius = Math.min(75, length * 0.72)
          const direction = door.swingDirection === 'outward' ? 1 : -1
          const swingX = hingeX - direction * vy / length * radius
          const swingY = hingeY + direction * vx / length * radius
          return (
            <g key={door.id}>
              <g>
                <rect
                  aria-label={`Изменить направление открывания ${door.panelLabel}`}
                  className="production-plan-control"
                  fill="#fff"
                  fillOpacity="0.01"
                  height={Math.max(18, Math.abs(swingY - hingeY) + 18)}
                  role="button"
                  tabIndex={0}
                  width={Math.max(18, Math.abs(swingX - hingeX) + 18)}
                  x={Math.min(hingeX, swingX) - 9}
                  y={Math.min(hingeY, swingY) - 9}
                  onClick={() => onDoor(door, { swingDirection: door.swingDirection === 'outward' ? 'inward' : 'outward' })}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onDoor(door, { swingDirection: door.swingDirection === 'outward' ? 'inward' : 'outward' }) }}
                ><title>Изменить направление открывания</title></rect>
                <line markerEnd="url(#production-swing-arrow)" pointerEvents="none" stroke="#d97706" strokeDasharray="5 4" strokeWidth="3" x1={hingeX} x2={swingX} y1={hingeY} y2={swingY} />
              </g>
              {(['left', 'right'] as const).map((edge) => {
                const x = edge === 'left' ? segment.x1 : segment.x2
                const y = edge === 'left' ? segment.y1 : segment.y2
                const controlX = x - (-(segment.y2 - segment.y1) / length) * 13
                const controlY = y - ((segment.x2 - segment.x1) / length) * 13
                const selected = edge === door.hingeEdge
                return (
                  <g aria-label={`${door.panelLabel}: петли ${edge === 'left' ? 'слева' : 'справа'}`} className="production-plan-control" key={edge} role="button" tabIndex={0} onClick={() => onDoor(door, { hingeEdge: edge })} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onDoor(door, { hingeEdge: edge }) }}>
                    <title>{selected && door.hingeSku ? `${hingeJointLabels[door.hingeJointType]} · ${door.hingeSku}. ` : ''}Поставить петли {edge === 'left' ? 'на левую' : 'на правую'} сторону</title>
                    <line pointerEvents="none" stroke="#d97706" strokeWidth="1" x1={x} x2={controlX} y1={y} y2={controlY} />
                    <circle cx={controlX} cy={controlY} fill="#fff" fillOpacity="0.01" r="12" />
                    <circle cx={controlX} cy={controlY} fill={selected ? '#d97706' : '#fff'} pointerEvents="none" r={selected ? 7 : 5} stroke="#d97706" strokeWidth="2" />
                  </g>
                )
              })}
            </g>
          )
        })}
        {draft.magneticPlacements.map((magnetic) => {
          const firstSegment = segments[magnetic.panelIndex]
          const secondSegment = magnetic.pairedPanelIndex === undefined ? undefined : segments[magnetic.pairedPanelIndex]
          if (!firstSegment) return null
          const firstPoint = segmentEndpoint(firstSegment, magnetic.edge)
          const secondPoint = secondSegment && magnetic.pairedEdge ? segmentEndpoint(secondSegment, magnetic.pairedEdge) : undefined
          const points = secondPoint && Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y) > 18
            ? [firstPoint, secondPoint]
            : [{ x: secondPoint ? (firstPoint.x + secondPoint.x) / 2 : firstPoint.x, y: secondPoint ? (firstPoint.y + secondPoint.y) / 2 : firstPoint.y }]
          return (
            <g aria-label="Изменить магнитный притвор" className="production-plan-control" key={magnetic.id} role="button" tabIndex={0} onClick={() => setEditor({ kind: 'magnetic', id: magnetic.id })}>
              <title>{magneticJointLabel(magnetic)}. Магнит всегда расположен напротив петель.</title>
              {points.map((point, index) => <g key={index}>
                <circle cx={point.x} cy={point.y} fill="#fff" r="10" stroke="#e11d48" strokeWidth="2" />
                <text fill="#be123c" fontSize="8.5" fontWeight="900" pointerEvents="none" textAnchor="middle" x={point.x} y={point.y + 3}>М</text>
              </g>)}
            </g>
          )
        })}
        <defs>
          <marker id="production-plan-arrow" markerHeight="5" markerWidth="5" orient="auto-start-reverse" refX="3" refY="3" viewBox="0 0 6 6"><path d="M0 3 L6 0 L6 6 Z" fill="#0f172a" /></marker>
          <marker id="production-swing-arrow" markerHeight="7" markerWidth="7" orient="auto" refX="5" refY="3.5" viewBox="0 0 7 7"><path d="M0 0 L7 3.5 L0 7 Z" fill="#d97706" /></marker>
        </defs>
        <g transform="translate(40 22)">
          <line stroke="#2563eb" strokeWidth="7" x1="0" x2="24" y1="0" y2="0" /><text fill="#475569" fontSize="10" x="31" y="4">неподвижное стекло</text>
          <line stroke="#f59e0b" strokeWidth="7" x1="145" x2="169" y1="0" y2="0" /><text fill="#475569" fontSize="10" x="176" y="4">дверь</text>
          <line stroke="#cbd5e1" strokeWidth="12" x1="257" x2="281" y1="0" y2="0" /><line stroke="#f8fafc" strokeWidth="8" x1="257" x2="281" y1="0" y2="0" /><text fill="#475569" fontSize="10" x="288" y="4">порожек</text>
        </g>
      </svg>

      {activeConnector ? (
        <div className="production-plan-popover">
          <header><div><strong>Крепление · {activeConnector.panelLabel}</strong><span>{activeConnector.sku}</span></div><button aria-label="Закрыть настройку" type="button" onClick={() => setEditor(null)}><X size={15} /></button></header>
          <label><span>Тип крепления</span><select value={activeConnector.mountType} onChange={(event) => {
            const mountType = event.target.value as 'connectors' | 'profile'
            onConnector(activeConnector, { mountType, profileHardwareItemId: mountType === 'profile' ? activeConnector.profileHardwareItemId ?? profileOptions[0]?.id : activeConnector.profileHardwareItemId })
          }}><option value="connectors">Коннекторы</option><option value="profile">Опорный профиль</option></select></label>
          {activeConnector.mountType === 'connectors' ? <>
            <div className="production-placement-controls">
              <CountStepper label="По вертикали" maximum={3} value={activeConnector.verticalCount} onChange={(value) => onConnector(activeConnector, { verticalCount: value })} />
              <CountStepper label="По горизонтали" maximum={2} value={activeConnector.horizontalCount} onChange={(value) => onConnector(activeConnector, { horizontalCount: value })} />
            </div>
            <div className="production-select-row">
              <label><span>Вертикальная кромка</span><select value={activeConnector.verticalEdge} onChange={(event) => onConnector(activeConnector, { verticalEdge: event.target.value as 'left' | 'right' })}><option value="left">Левая</option><option value="right">Правая</option></select></label>
              <label><span>Горизонтальная кромка</span><select value={activeConnector.horizontalEdge} onChange={(event) => onConnector(activeConnector, { horizontalEdge: event.target.value as 'top' | 'bottom' })}><option value="bottom">Нижняя</option><option value="top">Верхняя</option></select></label>
            </div>
          </> : (
            <label><span>Профиль</span><select value={activeConnector.profileHardwareItemId ?? profileOptions[0]?.id ?? ''} onChange={(event) => onConnector(activeConnector, { profileHardwareItemId: event.target.value })}>{profileOptions.map((item) => <option key={item.id} value={item.id}>{item.sku || item.label} · {Math.round(item.price)} ₽</option>)}</select></label>
          )}
        </div>
      ) : null}

      {activeMagnetic ? (
        <div className="production-plan-popover is-magnetic">
          <header><div><strong>{magneticJointLabel(activeMagnetic)}</strong><span>{activeMagnetic.pairedPanelLabel ? `${activeMagnetic.panelLabel} + ${activeMagnetic.pairedPanelLabel}` : activeMagnetic.panelLabel}</span></div><button aria-label="Закрыть настройку" type="button" onClick={() => setEditor(null)}><X size={15} /></button></header>
          {activeMagnetic.jointType === 'invalid' ? <p>Перенесите петли: магнитные кромки обеих дверей должны встретиться в одной точке.</p> : <>
            <label><span>{activeMagnetic.jointType === 'corner-90' || activeMagnetic.jointType === 'corner-135' ? 'Отступ каждого стекла, мм' : activeMagnetic.jointType === 'wall-strike' ? 'Магнитная часть, мм' : 'Между стеклами, мм'}</span><input inputMode="numeric" min="0" step="1" type="number" value={Math.round(activeMagnetic.gapMm)} onChange={(event) => onMagnetic(activeMagnetic, { gapMm: clamp(Number(event.target.value), 0, 100) })} /></label>
            {activeMagnetic.jointType === 'wall-strike' ? <label><span>Профиль-притвор, мм</span><input inputMode="numeric" min="0" step="1" type="number" value={Math.round(activeMagnetic.strikeWidthMm)} onChange={(event) => onMagnetic(activeMagnetic, { strikeWidthMm: clamp(Number(event.target.value), 0, 100) })} /></label> : null}
          </>}
        </div>
      ) : null}
    </div>
  )
}

type ConstructorProps = {
  catalog: PricingCatalog
  draft: ReturnType<typeof createProductionPackage>
  onOpeningHeight: (value: number) => void
  onCurbWidth: (value: number) => void
  onOpeningSegment: (segmentId: string, value: number) => void
  onDoor: (placement: ProductionDoorPlacement, patch: Partial<ProductionDoorPlacement>) => void
  onConnector: (placement: ProductionConnectorPlacement, patch: Partial<ProductionConnectorPlacement>) => void
  onMagnetic: (placement: ProductionMagneticPlacement, patch: Partial<ProductionMagneticPlacement>) => void
}

function ProductionConstructor({ catalog, draft, onOpeningHeight, onCurbWidth, onOpeningSegment, onDoor, onConnector, onMagnetic }: ConstructorProps) {
  return (
    <section className="production-constructor">
      <div className="production-section-head">
        <div><span>1</span><div><h3>Схема проёма и фурнитуры</h3><p>Проверьте поддон, притвор и крепления до выпуска стекла</p></div></div>
        <Ruler size={20} aria-hidden="true" />
      </div>
      <div className="production-constructor-layout">
        <ProductionPlanView catalog={catalog} draft={draft} onConnector={onConnector} onDoor={onDoor} onMagnetic={onMagnetic} />
        <div className="production-opening-list">
          <article>
            <header><strong>Замеры проёма / поддона</strong><span>Исходные размеры</span></header>
            <div className="production-opening-inputs">
              <label><span>Высота проёма</span><input inputMode="numeric" min="1" step="1" type="number" value={Math.round(draft.openingHeightMm)} onChange={(event) => onOpeningHeight(clamp(Number(event.target.value), 1, 3500))} /></label>
              <label><span>Ширина порожка</span><input inputMode="numeric" min="20" step="1" type="number" value={Math.round(draft.trayCurbWidthMm)} onChange={(event) => onCurbWidth(clamp(Number(event.target.value), 20, 300))} /></label>
              {draft.openingSegments.map((segment) => (
                <label key={segment.id}><span>{segment.label}</span><input inputMode="numeric" min="100" step="1" type="number" value={Math.round(segment.trayLengthMm)} onChange={(event) => onOpeningSegment(segment.id, clamp(Number(event.target.value), 100, 6000))} /></label>
              ))}
            </div>
            <p>Габариты вводятся по внешнему краю. Стекло устанавливается по центру порожка.</p>
          </article>
          <article>
            <header><strong>Ось установки и стекла</strong><span>Автоматически</span></header>
            <div className="production-opening-results">
              {draft.openingSegments.map((segment) => <p className="is-axis" key={`axis-${segment.id}`}><span>Ось · {segment.label}</span><strong>{Math.round(segment.lengthMm)} мм</strong></p>)}
              {draft.panels.map((panel, panelIndex) => <p key={panel.id}><span>{panelIndex + 1}. {panel.label}</span><strong>{Math.round(panel.widthMm)} × {Math.round(panel.heightMm)} мм</strong></p>)}
              {draft.doorPlacements.filter((door) => door.motionType === 'hinged').map((door) => <p className="is-hardware" key={`hinge-${door.id}`}><span>{door.panelLabel} · петли</span><strong>{hingeJointLabels[door.hingeJointType]}{door.hingeSku ? ` · ${door.hingeSku}` : ''} · {door.hingeQuantity} шт.</strong></p>)}
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

export function ProductionWorkspace({ catalog, form, itemIndex, quoteNumber, onClose, onFormChange, onPreview }: ProductionWorkspaceProps) {
  const [workingForm, setWorkingForm] = useState<CalculatorForm>(() => ({ ...form, dimensions: { ...form.dimensions } }))
  const [designOverrides, setDesignOverrides] = useState<ProductionDesignOverrides>(() => form.productionDesign ?? {})
  const [notes, setNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const workingFormRef = useRef(workingForm)
  const designOverridesRef = useRef(designOverrides)
  const initialDesignSyncedRef = useRef(false)
  workingFormRef.current = workingForm
  designOverridesRef.current = designOverrides
  const draft = useMemo(() => ({
    ...createProductionPackage(catalog, workingForm, quoteNumber, itemIndex, designOverrides),
    notes,
  }), [catalog, designOverrides, itemIndex, notes, quoteNumber, workingForm])
  const validationErrors = useMemo(() => getProductionValidationErrors(draft), [draft])
  const verifiedCount = draft.templateChecks.filter((check) => check.status === 'verified' || check.status === 'not-required').length
  const operationCount = draft.panels.reduce((total, panel) => total + panel.operations.length, 0)
  const quoteTotal = calculateQuote(catalog, workingForm).total

  const commitDesign = useCallback((nextDesign: ProductionDesignOverrides) => {
    const currentForm = workingFormRef.current
    const nextDraft = createProductionPackage(catalog, currentForm, quoteNumber, itemIndex, nextDesign)
    const normalizedDesign: ProductionDesignOverrides = {
      ...nextDesign,
      opening: {
        ...nextDesign.opening,
        heightMm: nextDraft.openingHeightMm,
        curbWidthMm: nextDraft.trayCurbWidthMm,
        segments: Object.fromEntries(nextDraft.openingSegments.map((segment) => [segment.id, segment.trayLengthMm])),
      },
      doors: Object.fromEntries(nextDraft.doorPlacements.map((door) => [door.id, {
        ...nextDesign.doors?.[door.id],
        hingeEdge: door.hingeEdge,
        swingDirection: door.swingDirection,
        hingeJointType: door.hingeJointType,
        hingeHardwareItemId: door.hingeHardwareItemId,
        hingeQuantity: door.hingeQuantity,
      }])),
    }
    const construction = getConstruction(catalog, currentForm.constructionId)
    const nextDimensions = { ...currentForm.dimensions }
    const heightField = construction.fields.find((field) => field.key.startsWith('HEIGHT'))
    if (heightField) nextDimensions[heightField.key] = Math.round(nextDraft.openingHeightMm)
    construction.fields.filter((field) => field.key.startsWith('WIDTH')).forEach((field, index) => {
      const panel = nextDraft.panels[index]
      if (panel) nextDimensions[field.key] = Math.round(panel.openingWidthMm)
    })
    const glass = getOption(catalog.glass, currentForm.glassId)
    const baseHardwarePrice = getConstructionHardwareComponents(catalog, construction, glass.thickness)
      .reduce((sum, component) => sum + component.total, 0)
    const productionHardwarePrice = nextDraft.purchases.reduce((sum, purchase) => {
      const item = catalog.hardwareItems.find((entry) => entry.id === purchase.hardwareItemId)
      return sum + (item?.price ?? 0) * purchase.quantity
    }, 0)
    const nextForm: CalculatorForm = {
      ...currentForm,
      dimensions: nextDimensions,
      productionDesign: normalizedDesign,
      productionPriceAdjustment: productionHardwarePrice - baseHardwarePrice,
    }
    designOverridesRef.current = normalizedDesign
    workingFormRef.current = nextForm
    setDesignOverrides(normalizedDesign)
    setWorkingForm(nextForm)
    onFormChange(nextForm)
  }, [catalog, itemIndex, onFormChange, quoteNumber])

  useEffect(() => {
    if (initialDesignSyncedRef.current) return
    initialDesignSyncedRef.current = true
    commitDesign(designOverridesRef.current)
  }, [commitDesign])

  const generatePdf = useCallback(async () => {
    const errors = getProductionValidationErrors(draft)
    if (errors.length > 0 || generating) {
      if (errors.length > 0) setError(errors[0])
      return
    }
    setGenerating(true)
    setError('')
    try {
      const preview = await shareProductionPdf(draft)
      onPreview(preview)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сформировать PDF')
    } finally {
      setGenerating(false)
    }
  }, [draft, generating, onClose, onPreview])

  const updateOpeningHeight = useCallback((heightMm: number) => {
    const current = designOverridesRef.current
    commitDesign({
      ...current,
      opening: {
        ...current.opening,
        heightMm,
      },
    })
  }, [commitDesign])

  const updateCurbWidth = useCallback((curbWidthMm: number) => {
    const current = designOverridesRef.current
    commitDesign({
      ...current,
      opening: {
        ...current.opening,
        curbWidthMm,
      },
    })
  }, [commitDesign])

  const updateOpeningSegment = useCallback((segmentId: string, value: number) => {
    const current = designOverridesRef.current
    commitDesign({
      ...current,
      opening: {
        ...current.opening,
        segments: {
          ...current.opening?.segments,
          [segmentId]: value,
        },
      },
    })
  }, [commitDesign])

  const updateDoor = useCallback((placement: ProductionDoorPlacement, patch: Partial<ProductionDoorPlacement>) => {
    const current = designOverridesRef.current
    commitDesign({
      ...current,
      doors: {
        ...current.doors,
        [placement.id]: { ...current.doors?.[placement.id], ...patch },
      },
    })
  }, [commitDesign])

  const updateConnector = useCallback((placement: ProductionConnectorPlacement, patch: Partial<ProductionConnectorPlacement>) => {
    const current = designOverridesRef.current
    commitDesign({
      ...current,
      connectors: {
        ...current.connectors,
        [placement.id]: { ...current.connectors?.[placement.id], ...patch },
      },
    })
  }, [commitDesign])

  const updateMagnetic = useCallback((placement: ProductionMagneticPlacement, patch: Partial<ProductionMagneticPlacement>) => {
    const current = designOverridesRef.current
    commitDesign({
      ...current,
      magnetic: {
        ...current.magnetic,
        [placement.id]: { ...current.magnetic?.[placement.id], ...patch },
      },
    })
  }, [commitDesign])

  return (
    <div className="production-backdrop">
      <section aria-labelledby="production-title" aria-modal="true" className="production-dialog" role="dialog">
        <header className="production-dialog-head">
          <div>
            <span>КП {quoteNumber} · позиция {itemIndex + 1}</span>
            <h2 id="production-title">Автоматические чертежи стекол</h2>
            <p>{draft.constructionTitle} · {draft.glassThickness} мм · {draft.hardwareClass}</p>
          </div>
          <div className="production-price-badge"><span>Стоимость позиции</span><strong>{new Intl.NumberFormat('ru-RU').format(quoteTotal)} ₽</strong></div>
          <button aria-label="Закрыть производственные чертежи" className="production-close" title="Закрыть" type="button" onClick={onClose}><X size={21} /></button>
        </header>

        <div className="production-dialog-body">
          <section className={validationErrors.length === 0 ? 'production-auto-state is-ready' : 'production-auto-state is-blocked'}>
            <div className="production-auto-icon">
              {generating ? <LoaderCircle className="is-spinning" size={28} /> : validationErrors.length === 0 ? <ShieldCheck size={28} /> : <AlertTriangle size={28} />}
            </div>
            <div>
              <h3>{generating ? 'Формируем PDF и DXF 1:1' : validationErrors.length === 0 ? 'Все шаблоны проверены' : 'Нужны данные по фурнитуре'}</h3>
              <p>
                {generating
                  ? 'Стекла, зазоры, отверстия, вырезы, карта напила и закупка уже рассчитаны.'
                  : validationErrors.length === 0
                    ? 'Проверьте схему, размеры и количество креплений, затем выпустите PDF и DXF 1:1.'
                    : 'Система не выпускает в производство неподтверждённые размеры.'}
              </p>
            </div>
            <div className="production-auto-metrics">
              <span><strong>{draft.panels.length}</strong> стекла</span>
              <span><strong>{operationCount}</strong> обработок</span>
              <span><strong>{verifiedCount}/{draft.templateChecks.length}</strong> позиций</span>
            </div>
          </section>

          {draft.blockingIssues.length > 0 ? (
            <section className="production-blockers">
              <div className="production-section-head">
                <div><span>!</span><div><h3>PDF остановлен</h3><p>Исправьте состав или добавьте заводской шаблон</p></div></div>
              </div>
              {draft.blockingIssues.map((issue) => <p key={issue}><AlertTriangle size={16} /> {issue}</p>)}
            </section>
          ) : null}

          <ProductionAssemblyPreview catalog={catalog} draft={draft} />

          <ProductionConstructor
            catalog={catalog}
            draft={draft}
            onConnector={updateConnector}
            onDoor={updateDoor}
            onMagnetic={updateMagnetic}
            onCurbWidth={updateCurbWidth}
            onOpeningHeight={updateOpeningHeight}
            onOpeningSegment={updateOpeningSegment}
          />

          <section>
            <div className="production-section-head">
              <div><span>2</span><div><h3>Стекла и обработки</h3><p>Построены из подтверждённой схемы проёма</p></div></div>
              <Scissors size={20} aria-hidden="true" />
            </div>
            <div className="production-glass-grid">
              {draft.panels.map((panel, index) => (
                <article className="production-glass-card" key={panel.id}>
                  <PanelMiniature panel={panel} />
                  <div>
                    <span>{panel.role === 'door' ? 'Дверь' : 'Неподвижное'} · стекло {index + 1}</span>
                    <h4>{panel.label}</h4>
                    <strong>{formatMm(panel.widthMm)} × {formatMm(panel.heightMm)} × {draft.glassThickness} мм</strong>
                    {panel.clearances.length > 0 ? (
                      <p>
                        Расчётный участок проёма {formatMm(panel.openingWidthMm)} × {formatMm(panel.openingHeightMm)}. {panel.clearances.map((item) => `${formatSignedMm(item.widthAdjustmentMm || item.heightAdjustmentMm)}: ${item.label}`).join('; ')}.
                      </p>
                    ) : null}
                    {panel.operations.length > 0 ? (
                      <ul>
                        {panel.operations.map((operation) => (
                          <li key={operation.id}>
                            <CheckCircle2 size={14} />
                            <span>{operationKindLabels[operation.kind]}: {operation.label}</span>
                            {operation.sourceUrl ? <a aria-label={`Открыть чертёж ${operation.sourceSku}`} href={operation.sourceUrl} rel="noreferrer" target="_blank"><ExternalLink size={14} /></a> : null}
                          </li>
                        ))}
                      </ul>
                    ) : <p>Сверления и вырезы не требуются.</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="production-section-head">
              <div><span>3</span><div><h3>Проверка фурнитуры</h3><p>Каждый артикул сопоставлен с заводским чертежом</p></div></div>
              <strong>{verifiedCount} из {draft.templateChecks.length}</strong>
            </div>
            <div className="production-template-list">
              {draft.templateChecks.map((check) => (
                <div className={`production-template-row is-${check.status}`} key={check.id}>
                  {check.status === 'verified' || check.status === 'not-required' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  <span><strong>{check.sku || check.label}</strong><small>{check.message}</small></span>
                  <b>{check.quantity} шт.</b>
                  <em>{statusLabels[check.status]}</em>
                  {check.drawingUrl ? <a aria-label={`Открыть монтажный чертёж ${check.sku}`} href={check.drawingUrl} rel="noreferrer" target="_blank"><ExternalLink size={16} /></a> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="production-two-columns">
            <div>
              <div className="production-section-head">
                <div><span>4</span><div><h3>Карта напила</h3><p>Профили, трубы и треки</p></div></div>
                <Ruler size={20} aria-hidden="true" />
              </div>
              {draft.cuts.length > 0 ? (
                <div className="production-compact-list">
                  {draft.cuts.map((item) => (
                    <div key={item.id}>
                      <span><strong>{item.sku || item.label}</strong><small>{item.label}</small></span>
                      <b>{item.quantity} × {formatMm(item.cutLengthMm)}</b>
                    </div>
                  ))}
                </div>
              ) : <p className="production-empty-row">Напил для этой конструкции не требуется.</p>}
            </div>
            <div>
              <div className="production-section-head">
                <div><span>5</span><div><h3>Закупка</h3><p>Состав рассчитанной душевой</p></div></div>
                <PackageCheck size={20} aria-hidden="true" />
              </div>
              <div className="production-compact-list">
                {draft.purchases.map((item) => (
                  <div key={item.id}>
                    <span><strong>{item.sku || item.label}</strong><small>{item.label}</small></span>
                    <b>{item.quantity} шт.</b>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <label className="production-notes-field">
              <span>Примечание для производства</span>
              <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </section>
        </div>

        <footer className="production-dialog-footer">
          <div>
            {error ? <p className="production-error"><AlertTriangle size={16} /> {error}</p> : null}
            {!error && generating ? <p>PDF откроется сразу после формирования.</p> : null}
            {!error && !generating && validationErrors.length > 0 ? <p>{validationErrors[0]}</p> : null}
          </div>
          <button type="button" onClick={onClose}>Закрыть</button>
          <button className="production-primary" disabled={generating || validationErrors.length > 0} type="button" onClick={() => void generatePdf()}>
            {generating ? <LoaderCircle className="is-spinning" size={18} /> : <FileDown size={18} />}
            {generating ? 'Формируем...' : 'Создать PDF и DXF'}
          </button>
        </footer>
      </section>
    </div>
  )
}
