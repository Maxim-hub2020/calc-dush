import { useState } from 'react'
import { ExternalLink, Eye, ImageOff } from 'lucide-react'
import type { PricingCatalog } from './pricing'
import type { createProductionPackage, ProductionPanel } from './productionPlanning'
import { getShowerHardwareImage } from './showerHardwareImages'

type ProductionDraft = ReturnType<typeof createProductionPackage>

type AssemblyPreviewProps = {
  catalog: PricingCatalog
  draft: ProductionDraft
}

const assemblySegments = (draft: ProductionDraft) => {
  const count = Math.max(1, draft.panels.length)
  if (draft.constructionSketch === 'trapezoid') {
    return [
      { x1: 95, y1: 200, x2: 205, y2: 80 },
      { x1: 205, y1: 80, x2: 405, y2: 80 },
      { x1: 405, y1: 80, x2: 515, y2: 200 },
    ].slice(0, count)
  }
  if (['corner', 'corner-plus', 'double-corner', 'slider-corner', 'slider-double'].includes(draft.constructionSketch)) {
    const result = Array.from({ length: count }, () => ({ x1: 0, y1: 0, x2: 0, y2: 0 }))
    const firstIndexes = draft.openingSegments[0]?.panelIndexes ?? [0]
    const secondIndexes = draft.openingSegments[1]?.panelIndexes ?? []
    firstIndexes.forEach((panelIndex, position) => {
      result[panelIndex] = {
        x1: 80 + position * (310 / firstIndexes.length),
        y1: 190,
        x2: 80 + (position + 1) * (310 / firstIndexes.length),
        y2: 190,
      }
    })
    secondIndexes.forEach((panelIndex, position) => {
      result[panelIndex] = {
        x1: 390,
        y1: 190 - position * (125 / Math.max(1, secondIndexes.length)),
        x2: 390,
        y2: 190 - (position + 1) * (125 / Math.max(1, secondIndexes.length)),
      }
    })
    return result
  }
  return Array.from({ length: count }, (_, index) => ({
    x1: 80 + index * (470 / count),
    y1: 150,
    x2: 80 + (index + 1) * (470 / count),
    y2: 150,
  }))
}

const project = (x: number, y: number, height = 0) => ({
  x: x + (y - 135) * 0.42 + 22,
  y: 318 - height + (y - 135) * 0.22,
})

const pointAtEdge = (
  segment: { x1: number; y1: number; x2: number; y2: number },
  edge: 'left' | 'right',
  height: number,
) => project(edge === 'left' ? segment.x1 : segment.x2, edge === 'left' ? segment.y1 : segment.y2, height)

const panelPolygon = (segment: ReturnType<typeof assemblySegments>[number], height: number) => {
  const bottomLeft = project(segment.x1, segment.y1)
  const bottomRight = project(segment.x2, segment.y2)
  const topRight = project(segment.x2, segment.y2, height)
  const topLeft = project(segment.x1, segment.y1, height)
  return [bottomLeft, bottomRight, topRight, topLeft].map((point) => `${point.x},${point.y}`).join(' ')
}

const panelHeight = (panel: ProductionPanel, maximumHeight: number) => Math.max(150, 225 * panel.heightMm / maximumHeight)

function HardwarePhoto({ imageUrl, label }: { imageUrl?: string; label: string }) {
  const [failed, setFailed] = useState(false)
  if (!imageUrl || failed) return <span className="production-hardware-photo-fallback"><ImageOff size={22} /></span>
  return <img alt={label} loading="lazy" referrerPolicy="no-referrer" src={imageUrl} onError={() => setFailed(true)} />
}

export function ProductionAssemblyPreview({ catalog, draft }: AssemblyPreviewProps) {
  const segments = assemblySegments(draft)
  const maximumHeight = Math.max(...draft.panels.map((panel) => panel.heightMm), 1)
  const hardware = draft.purchases.map((purchase) => {
    const item = catalog.hardwareItems.find((entry) => entry.id === purchase.hardwareItemId)
    return { purchase, item, imageUrl: getShowerHardwareImage(item) }
  })
  const hasSlidingDoor = draft.doorPlacements.some((door) => door.motionType === 'sliding')

  return (
    <section className="production-assembly-section">
      <div className="production-section-head">
        <div><span><Eye size={15} /></span><div><h3>Собранная душевая</h3><p>Стекла и фурнитура из текущего состава</p></div></div>
        <strong>{hardware.length} позиций</strong>
      </div>
      <div className="production-assembly-layout">
        <div className="production-assembly-scene">
          <svg aria-label="Собранный вид душевой с фурнитурой" viewBox="0 0 650 350">
            <rect fill="#f8fafc" height="350" width="650" />
            <path d="M45 320 H610" stroke="#cbd5e1" strokeWidth="2" />
            <path d="M70 320 L132 338 H555 L610 320" fill="#f1f5f9" stroke="#dbe4ef" />
            {segments.map((segment, index) => {
              const panel = draft.panels[index]
              if (!panel) return null
              const height = panelHeight(panel, maximumHeight)
              const center = project((segment.x1 + segment.x2) / 2, (segment.y1 + segment.y2) / 2, height * 0.52)
              return (
                <g key={panel.id}>
                  <polygon
                    fill={panel.role === 'door' ? 'rgb(254 243 199 / 58%)' : 'rgb(219 234 254 / 62%)'}
                    points={panelPolygon(segment, height)}
                    stroke={panel.role === 'door' ? '#d97706' : '#2563eb'}
                    strokeWidth="2"
                  />
                  <circle cx={center.x} cy={center.y} fill="#fff" r="12" stroke="#64748b" />
                  <text fill="#172033" fontSize="11" fontWeight="800" textAnchor="middle" x={center.x} y={center.y + 4}>{index + 1}</text>
                </g>
              )
            })}
            {draft.connectorPlacements.flatMap((placement) => {
              const segment = segments[placement.panelIndex]
              const panel = draft.panels[placement.panelIndex]
              if (!segment || !panel || placement.mountType === 'profile') return []
              const height = panelHeight(panel, maximumHeight)
              return Array.from({ length: placement.verticalCount }, (_, index) => {
                const position = height * (index + 1) / (placement.verticalCount + 1)
                const point = pointAtEdge(segment, placement.verticalEdge, position)
                return <rect fill="#334155" height="11" key={`${placement.id}:v:${index}`} rx="2" stroke="#fff" width="11" x={point.x - 5.5} y={point.y - 5.5} />
              })
            })}
            {draft.doorPlacements.flatMap((door) => {
              const segment = segments[door.panelIndex]
              const panel = draft.panels[door.panelIndex]
              if (!segment || !panel) return []
              const height = panelHeight(panel, maximumHeight)
              if (door.motionType === 'sliding') {
                return [0.28, 0.72].map((position, index) => {
                  const x = segment.x1 + (segment.x2 - segment.x1) * position
                  const y = segment.y1 + (segment.y2 - segment.y1) * position
                  const point = project(x, y, height - 18)
                  return <circle cx={point.x} cy={point.y} fill="#475569" key={`${door.id}:roller:${index}`} r="8" stroke="#fff" strokeWidth="2" />
                })
              }
              return [0.28, 0.72].map((position, index) => {
                const point = pointAtEdge(segment, door.hingeEdge, height * position)
                return <rect fill="#475569" height="18" key={`${door.id}:hinge:${index}`} rx="2" stroke="#fff" width="9" x={point.x - 4.5} y={point.y - 9} />
              })
            })}
            {draft.doorPlacements.map((door) => {
              const segment = segments[door.panelIndex]
              const panel = draft.panels[door.panelIndex]
              if (!segment || !panel) return null
              const edge = door.hingeEdge === 'left' ? 'right' : 'left'
              const point = pointAtEdge(segment, edge, panelHeight(panel, maximumHeight) * 0.5)
              return <circle cx={point.x} cy={point.y} fill="#fff" key={`${door.id}:handle`} r="7" stroke="#172033" strokeWidth="3" />
            })}
            {draft.magneticPlacements.map((placement) => {
              const segment = segments[placement.panelIndex]
              const panel = draft.panels[placement.panelIndex]
              if (!segment || !panel) return null
              const bottom = pointAtEdge(segment, placement.edge, 10)
              const top = pointAtEdge(segment, placement.edge, panelHeight(panel, maximumHeight) - 10)
              return <line key={placement.id} stroke="#e11d48" strokeDasharray="5 4" strokeWidth="4" x1={bottom.x} x2={top.x} y1={bottom.y} y2={top.y} />
            })}
            {hasSlidingDoor ? <line stroke="#334155" strokeLinecap="round" strokeWidth="9" x1="92" x2="570" y1="78" y2="78" /> : null}
            <g transform="translate(22 20)">
              <rect fill="#fff" height="54" rx="6" stroke="#dbe4ef" width="183" />
              <rect fill="#dbeafe" height="12" stroke="#2563eb" width="22" x="12" y="11" />
              <text fill="#475569" fontSize="11" x="42" y="21">неподвижное стекло</text>
              <rect fill="#fef3c7" height="12" stroke="#d97706" width="22" x="12" y="32" />
              <text fill="#475569" fontSize="11" x="42" y="42">дверь</text>
            </g>
          </svg>
        </div>
        <div className="production-hardware-gallery">
          {hardware.map(({ purchase, imageUrl }) => (
            <a href={purchase.sourceUrl} key={purchase.hardwareItemId} rel="noreferrer" target="_blank">
              <span className="production-hardware-photo"><HardwarePhoto imageUrl={imageUrl} label={purchase.label} /></span>
              <span><strong>{purchase.sku || purchase.label}</strong><small>{purchase.label}</small></span>
              <b>{purchase.quantity} шт.</b>
              <ExternalLink aria-hidden="true" size={15} />
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
