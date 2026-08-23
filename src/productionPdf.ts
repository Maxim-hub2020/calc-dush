import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import { createProductionDxfBlob } from './productionDxf'
import type { ProductionCutItem, ProductionOperation, ProductionPackage, ProductionPanel } from './productionPlanning'

const colors = {
  accent: '#2563eb',
  accentSoft: '#eff6ff',
  border: '#cbd5e1',
  heading: '#111827',
  muted: '#64748b',
  surface: '#f8fafc',
  text: '#334155',
  warning: '#b45309',
  warningSoft: '#fff7ed',
}

const pdfLoadTimeoutMs = 25_000

const xml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

const formatDate = () => new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date())

const mm = (value: number) => `${Math.round(Number(value) || 0)} мм`

const operationKindLabel: Record<ProductionOperation['kind'], string> = {
  hole: 'Отверстие',
  notch: 'Паз',
  cutout: 'Вырез',
  template: 'По шаблону',
}

const operationSize = (operation: ProductionOperation) => {
  if (operation.kind === 'hole') return `Ø ${mm(operation.diameterMm)}`
  if (operation.profile === 'round-slot') {
    return `${mm(operation.heightMm)} × ${mm(operation.straightDepthMm)} + R${Math.round(operation.radiusMm)}`
  }
  if (operation.profile === 'hinge-cutout') {
    return `${mm(operation.widthMm)} × ${mm(operation.heightMm)}, R${Math.round(operation.radiusMm)}`
  }
  if (operation.widthMm > 0 || operation.heightMm > 0) return `${mm(operation.widthMm)} × ${mm(operation.heightMm)}`
  return 'Размер по шаблону'
}

const number = (value: number) => Math.round(value * 10) / 10

const uniqueNumbers = (values: number[]) => [...new Set(values.map((value) => Math.round(value)))]

const operationGroupKey = (operation: ProductionOperation) => [
  operation.sourceSku,
  operation.profile,
  Math.round(operation.diameterMm),
  Math.round(operation.widthMm),
  Math.round(operation.heightMm),
  operation.edge ?? '',
].join('|')

const buildOperationGroups = (panel: ProductionPanel) => {
  const groups = new Map<string, ProductionOperation[]>()
  panel.operations.forEach((operation) => {
    const key = operationGroupKey(operation)
    groups.set(key, [...(groups.get(key) ?? []), operation])
  })
  return [...groups.values()].map((operations, index) => ({
    id: `A${index + 1}`,
    operations,
    operation: operations[0],
  }))
}

const dimensionLine = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  rotate = false,
) => {
  const textX = (x1 + x2) / 2
  const textY = (y1 + y2) / 2 - (rotate ? 0 : 4)
  const transform = rotate ? ` transform="rotate(-90 ${textX} ${textY})"` : ''
  return `<line x1="${number(x1)}" y1="${number(y1)}" x2="${number(x2)}" y2="${number(y2)}" class="dim" marker-start="url(#dim-arrow)" marker-end="url(#dim-arrow)"/><text x="${number(textX)}" y="${number(textY)}" class="dim-text" text-anchor="middle"${transform}>${xml(label)}</text>`
}

const centerMark = (x: number, y: number, size = 6) => (
  `<path d="M ${number(x - size)} ${number(y)} H ${number(x + size)} M ${number(x)} ${number(y - size)} V ${number(y + size)}" class="center"/>`
)

const edgeCutPath = (
  operation: ProductionOperation,
  panelX: number,
  panelY: number,
  drawWidth: number,
  drawHeight: number,
  scale: number,
) => {
  if (operation.edge === 'top' || operation.edge === 'bottom') {
    const centerX = panelX + operation.xMm * scale
    const edgeY = operation.edge === 'top' ? panelY : panelY + drawHeight
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
  const edge = operation.edge ?? (operation.xMm < drawWidth / scale / 2 ? 'left' : 'right')
  const centerY = panelY + drawHeight - operation.yMm * scale
  const depth = operation.widthMm * scale
  const halfOpening = operation.heightMm * scale / 2
  const radius = operation.radiusMm * scale
  const straight = operation.straightDepthMm * scale

  if (edge === 'right') {
    const x = panelX + drawWidth
    if (operation.profile === 'hinge-cutout') {
      return `M ${x} ${centerY - halfOpening} H ${x - straight} A ${radius} ${radius} 0 0 0 ${x - depth} ${centerY - halfOpening + radius} V ${centerY + halfOpening - radius} A ${radius} ${radius} 0 0 0 ${x - straight} ${centerY + halfOpening} H ${x} Z`
    }
    return `M ${x} ${centerY - halfOpening} H ${x - straight} A ${radius} ${radius} 0 0 0 ${x - depth} ${centerY} A ${radius} ${radius} 0 0 0 ${x - straight} ${centerY + halfOpening} H ${x} Z`
  }

  const x = panelX
  if (operation.profile === 'hinge-cutout') {
    return `M ${x} ${centerY - halfOpening} H ${x + straight} A ${radius} ${radius} 0 0 1 ${x + depth} ${centerY - halfOpening + radius} V ${centerY + halfOpening - radius} A ${radius} ${radius} 0 0 1 ${x + straight} ${centerY + halfOpening} H ${x} Z`
  }
  return `M ${x} ${centerY - halfOpening} H ${x + straight} A ${radius} ${radius} 0 0 1 ${x + depth} ${centerY} A ${radius} ${radius} 0 0 1 ${x + straight} ${centerY + halfOpening} H ${x} Z`
}

const buildDetailSvg = (
  group: ReturnType<typeof buildOperationGroups>[number],
  panelWidthMm: number,
  panelHeightMm: number,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const operation = group.operation
  const title = `${group.id} · ${operation.sourceSku || operationKindLabel[operation.kind]}`
  const cx = x + width / 2
  const cy = y + 48
  const horizontalEdge = operation.edge === 'left' || operation.edge === 'right'
    ? operation.edge
    : operation.xMm <= panelWidthMm / 2 ? 'left' : 'right'
  const horizontalOffset = Math.round(horizontalEdge === 'left'
    ? operation.xMm
    : panelWidthMm - operation.xMm)
  const verticalOffsets = uniqueNumbers(group.operations.map((item) => item.yMm)).sort((left, right) => left - right)
  const verticalText = verticalOffsets.length === 1
    ? `ось: ${verticalOffsets[0]} от низа; ${Math.round(panelHeightMm - verticalOffsets[0])} от верха`
    : verticalOffsets.length <= 4
      ? `оси от низа: ${verticalOffsets.join(', ')} мм`
    : `оси от низа: ${verticalOffsets.slice(0, 4).join(', ')}... мм`
  const horizontalText = `ось от ${horizontalEdge === 'left' ? 'левой' : 'правой'} кромки: ${horizontalOffset} мм`
  let drawing = ''

  if (operation.profile === 'circle') {
    const radius = 13
    const centers = group.operations.length > 1 ? [cy - 22, cy + 22] : [cy]
    drawing += centers.map((centerY) => `<circle cx="${cx}" cy="${centerY}" r="${radius}" class="cut"/>${centerMark(cx, centerY, 5)}`).join('')
    drawing += `<path d="M ${cx + radius} ${centers[0]} L ${x + width - 12} ${centers[0] - 16}" class="leader"/><text x="${x + width - 10}" y="${centers[0] - 18}" class="detail-text" text-anchor="end">Ø${Math.round(operation.diameterMm)}</text>`
    if (centers.length > 1) {
      const actualSpacing = uniqueNumbers(group.operations.flatMap((item, index) => group.operations.slice(index + 1).map((other) => Math.abs(item.yMm - other.yMm))).filter((value) => value > 0 && value < 120))[0]
      if (actualSpacing) drawing += dimensionLine(cx - 28, centers[0], cx - 28, centers[1], `${actualSpacing}`, true)
    }
  } else if (operation.profile === 'round-slot') {
    const slotX = x + 58
    const slotY = cy - 10
    const straight = 45
    const radius = 18
    const total = straight + radius
    drawing += `<path d="M ${slotX} ${slotY - radius} H ${slotX + straight} A ${radius} ${radius} 0 0 1 ${slotX + total} ${slotY} A ${radius} ${radius} 0 0 1 ${slotX + straight} ${slotY + radius} H ${slotX} Z" class="cut"/>`
    drawing += dimensionLine(slotX, slotY + radius + 17, slotX + straight, slotY + radius + 17, `${Math.round(operation.straightDepthMm)}`)
    drawing += dimensionLine(slotX - 15, slotY - radius, slotX - 15, slotY + radius, `${Math.round(operation.heightMm)}`, true)
    drawing += `<path d="M ${slotX + total - 5} ${slotY - 5} L ${x + width - 12} ${y + 43}" class="leader"/><text x="${x + width - 10}" y="${y + 40}" class="detail-text" text-anchor="end">R${Math.round(operation.radiusMm)}</text>`
  } else {
    const cutX = x + 58
    const cutY = cy
    const straight = 42
    const radius = 20
    const depth = 62
    const opening = 55
    drawing += `<path d="M ${cutX} ${cutY - opening / 2} H ${cutX + straight} A ${radius} ${radius} 0 0 1 ${cutX + depth} ${cutY - opening / 2 + radius} V ${cutY + opening / 2 - radius} A ${radius} ${radius} 0 0 1 ${cutX + straight} ${cutY + opening / 2} H ${cutX} Z" class="cut"/>`
    drawing += dimensionLine(cutX, cutY + opening / 2 + 17, cutX + depth, cutY + opening / 2 + 17, `${Math.round(operation.widthMm)}`)
    drawing += dimensionLine(cutX - 15, cutY - opening / 2, cutX - 15, cutY + opening / 2, `${Math.round(operation.heightMm)}`, true)
    drawing += `<path d="M ${cutX + depth - 8} ${cutY - 8} L ${x + width - 12} ${y + 43}" class="leader"/><text x="${x + width - 10}" y="${y + 40}" class="detail-text" text-anchor="end">R${Math.round(operation.radiusMm)}</text>`
  }

  const locationNotes = operation.profile === 'circle'
    ? `<text x="${x + 9}" y="${y + height - 25}" class="detail-note">${xml(horizontalText)}</text><text x="${x + 9}" y="${y + height - 15}" class="detail-note">${xml(verticalText)}</text>`
    : operation.edge === 'top' || operation.edge === 'bottom'
      ? `<text x="${x + 9}" y="${y + height - 15}" class="detail-note">${xml(horizontalText.replace('ось', 'центр'))}</text>`
    : `<text x="${x + 9}" y="${y + height - 15}" class="detail-note">${xml(verticalText.replace('оси', 'центры').replace('ось:', 'центр:'))}</text>`
  return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" class="detail-box"/><text x="${x + 9}" y="${y + 17}" class="detail-title">${xml(title)}</text>${drawing}${locationNotes}<text x="${x + 9}" y="${y + height - 4}" class="detail-note">${xml(operationSize(operation))}</text></g>`
}

const extensionLine = (x1: number, y1: number, x2: number, y2: number) => (
  `<line x1="${number(x1)}" y1="${number(y1)}" x2="${number(x2)}" y2="${number(y2)}" class="extension"/>`
)

const buildLocationDimensions = (
  panel: ProductionPanel,
  groups: ReturnType<typeof buildOperationGroups>,
  x: number,
  y: number,
  drawW: number,
  drawH: number,
  scale: number,
) => {
  const verticalEntries = groups.flatMap((group) => {
    if (group.operation.edge === 'top' || group.operation.edge === 'bottom') return []
    return uniqueNumbers(group.operations.map((operation) => operation.yMm))
      .sort((left, right) => left - right)
      .map((value) => ({ groupId: group.id, value }))
  })
  const horizontalEntries = groups.flatMap((group) => {
    const operation = group.operation
    if (operation.profile !== 'circle' && operation.edge !== 'top' && operation.edge !== 'bottom') return []
    return uniqueNumbers(group.operations.map((item) => item.xMm))
      .sort((left, right) => left - right)
      .map((value) => ({
        groupId: group.id,
        value,
        edge: value <= panel.widthMm / 2 ? 'left' as const : 'right' as const,
      }))
  })

  const vertical = verticalEntries.map((entry, index) => {
    const dimX = x - 32 - index * 8
    const panelEdgeX = x
    const targetY = y + drawH - entry.value * scale
    return [
      extensionLine(panelEdgeX, targetY, dimX, targetY),
      extensionLine(panelEdgeX, y + drawH, dimX, y + drawH),
      dimensionLine(dimX, y + drawH, dimX, targetY, `${entry.groupId}: ${Math.round(entry.value)}`, true),
    ].join('')
  }).join('')

  const horizontal = horizontalEntries.slice(0, 5).map((entry, index) => {
    const dimY = y - 16 - index * 11
    const targetX = x + entry.value * scale
    const edgeX = entry.edge === 'left' ? x : x + drawW
    const offset = entry.edge === 'left' ? entry.value : panel.widthMm - entry.value
    return [
      extensionLine(edgeX, y, edgeX, dimY),
      extensionLine(targetX, y, targetX, dimY),
      dimensionLine(edgeX, dimY, targetX, dimY, `${entry.groupId}: ${Math.round(offset)}`),
    ].join('')
  }).join('')

  return vertical + horizontal
}

const buildPanelSvg = (panel: ProductionPanel) => {
  const width = Math.max(1, panel.widthMm)
  const height = Math.max(1, panel.heightMm)
  const maxW = 210
  const maxH = 340
  const scale = Math.min(maxW / width, maxH / height)
  const drawW = width * scale
  const drawH = height * scale
  const x = 100 + (maxW - drawW) / 2
  const y = 98 + (maxH - drawH) / 2
  const topWidth = Math.min(width, Math.max(1, panel.topWidthMm || width))
  const topInset = panel.shape === 'trapezoid' ? (width - topWidth) * scale / 2 : 0
  const panelPath = panel.shape === 'trapezoid'
    ? `M ${x} ${y + drawH} L ${x + topInset} ${y} L ${x + drawW - topInset} ${y} L ${x + drawW} ${y + drawH} Z`
    : `M ${x} ${y} H ${x + drawW} V ${y + drawH} H ${x} Z`
  const groups = buildOperationGroups(panel)
  const groupByOperation = new Map(groups.flatMap((group) => group.operations.map((operation) => [operation.id, group.id])))
  const operations = panel.operations.map((operation) => {
    const px = x + Math.min(width, operation.xMm) * scale
    const py = y + drawH - Math.min(height, operation.yMm) * scale
    if (operation.kind === 'hole') {
      const radius = Math.max(3.5, operation.diameterMm * scale / 2)
      return `<circle cx="${number(px)}" cy="${number(py)}" r="${number(radius)}" class="cut"/>${centerMark(px, py, 5)}`
    }
    return `<path d="${edgeCutPath(operation, x, y, drawW, drawH, scale)}" class="cut"/>`
  }).join('')
  const groupLabels = groups.flatMap((group) => {
    const sorted = [...group.operations].sort((left, right) => left.yMm - right.yMm)
    const clusters: ProductionOperation[][] = []
    sorted.forEach((operation) => {
      const cluster = clusters.at(-1)
      const previous = cluster?.at(-1)
      if (!cluster || !previous || operation.yMm - previous.yMm > 120) clusters.push([operation])
      else cluster.push(operation)
    })
    return clusters.map((cluster) => {
      const operation = cluster[0]
      const averageX = cluster.reduce((total, item) => total + item.xMm, 0) / cluster.length
      const averageY = cluster.reduce((total, item) => total + item.yMm, 0) / cluster.length
      const px = x + Math.min(width, averageX) * scale
      const py = y + drawH - Math.min(height, averageY) * scale
      return `<circle cx="${number(px + 10)}" cy="${number(py - 10)}" r="8" class="node-badge"/><text x="${number(px + 10)}" y="${number(py - 7)}" class="node-label" text-anchor="middle">${groupByOperation.get(operation.id)}</text>`
    })
  }).join('')
  const locationDimensions = buildLocationDimensions(panel, groups, x, y, drawW, drawH, scale)
  const detailWidth = 176
  const detailHeight = Math.min(118, Math.max(96, 410 / Math.max(1, groups.length)))
  const details = groups.slice(0, 4).map((group, index) => buildDetailSvg(group, panel.widthMm, panel.heightMm, 350, 60 + index * (detailHeight + 7), detailWidth, detailHeight)).join('')
  const clearanceTitle = `Расчётный участок проёма ${Math.round(panel.openingWidthMm)} × ${Math.round(panel.openingHeightMm)} мм; чистое стекло ${Math.round(panel.widthMm)} × ${Math.round(panel.heightMm)} мм`
  const clearanceItems = panel.clearances.length > 0
    ? panel.clearances.map((item) => {
      const adjustment = item.widthAdjustmentMm || item.heightAdjustmentMm
      return `${adjustment > 0 ? '+' : ''}${Math.round(adjustment)} ${item.label}`
    })
    : ['Без дополнительных вычетов']
  const clearanceDetails = [clearanceItems.slice(0, 2).join(' · '), clearanceItems.slice(2).join(' · ')].filter(Boolean)

  return `<svg width="535" height="545" viewBox="0 0 535 545" xmlns="http://www.w3.org/2000/svg">
    <defs><marker id="dim-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M 0 5 L 10 0 L 10 10 Z" fill="#111827"/></marker></defs>
    <style>.panel{fill:#f0f9ff;stroke:#111827;stroke-width:1.4}.cut{fill:#fff;stroke:#111827;stroke-width:1.35}.center{fill:none;stroke:#64748b;stroke-width:.7;stroke-dasharray:3 2}.dim{stroke:#111827;stroke-width:.7}.extension{stroke:#64748b;stroke-width:.55}.dim-text{font:8px Roboto,Arial,sans-serif;fill:#111827}.node-badge{fill:#fff;stroke:#2563eb;stroke-width:1}.node-label{font:bold 7px Roboto,Arial,sans-serif;fill:#1d4ed8}.detail-box{fill:#fff;stroke:#94a3b8;stroke-width:.7}.detail-title{font:bold 8px Roboto,Arial,sans-serif;fill:#111827}.detail-text{font:8px Roboto,Arial,sans-serif;fill:#111827}.detail-note{font:6.8px Roboto,Arial,sans-serif;fill:#475569}.clearance-text{font:bold 7px Roboto,Arial,sans-serif;fill:#1d4ed8}.leader{fill:none;stroke:#111827;stroke-width:.7}</style>
    <rect width="535" height="545" fill="#ffffff"/>
    <text x="12" y="18" class="detail-title">КОНТУР СТЕКЛА И ПРИВЯЗКИ ОБРАБОТОК</text>
    <text x="523" y="18" class="detail-note" text-anchor="end">Все размеры в миллиметрах</text>
    <text x="12" y="34" class="clearance-text">${xml(clearanceTitle)}</text>
    ${clearanceDetails.map((line, index) => `<text x="12" y="${46 + index * 10}" class="detail-note">${xml(line)}</text>`).join('')}
    <path d="${panelPath}" class="panel"/>
    ${operations}
    ${groupLabels}
    ${locationDimensions}
    <line x1="${x}" y1="${y + drawH}" x2="${x}" y2="${y + drawH + 27}" class="extension"/><line x1="${x + drawW}" y1="${y + drawH}" x2="${x + drawW}" y2="${y + drawH + 27}" class="extension"/>
    ${dimensionLine(x, y + drawH + 22, x + drawW, y + drawH + 22, `${Math.round(width)}`)}
    <line x1="${x}" y1="${y}" x2="${x - 21}" y2="${y}" class="extension"/><line x1="${x}" y1="${y + drawH}" x2="${x - 21}" y2="${y + drawH}" class="extension"/>
    ${dimensionLine(x - 17, y, x - 17, y + drawH, `${Math.round(height)}`, true)}
    ${panel.shape === 'trapezoid' ? `<text x="${x + drawW / 2}" y="${y - 8}" text-anchor="middle" class="dim-text">верх ${Math.round(topWidth)}</text>` : ''}
    ${details}
    <rect x="8" y="510" width="519" height="27" class="detail-box"/>
    <text x="17" y="522" class="detail-title">${xml(panel.label)} · ${panel.role === 'door' ? 'дверное стекло' : 'неподвижное стекло'} · ${Math.round(panel.widthMm)} × ${Math.round(panel.heightMm)} мм · ${panel.quantity} шт.</text>
    <text x="17" y="532" class="detail-note">Обработка кромок: полировка. Стекло: закалённое. Все оси привязаны размерными линиями к кромкам стекла.</text>
  </svg>`
}

const buildTopViewSvg = (draft: ProductionPackage) => {
  const segment = (x1: number, y1: number, x2: number, y2: number, index: number) => {
    const panel = draft.panels[index]
    if (!panel) return ''
    const middleX = (x1 + x2) / 2
    const middleY = (y1 + y2) / 2
    const length = Math.hypot(x2 - x1, y2 - y1) || 1
    const normalX = -(y2 - y1) / length
    const normalY = (x2 - x1) / length
    const connectorPlacements = draft.connectorPlacements.filter((placement) => placement.panelIndex === index)
    const connectorPlacement = connectorPlacements[0]
    const verticalConnectors = connectorPlacements.reduce((total, placement) => total + placement.verticalCount, 0)
    const horizontalConnectors = connectorPlacements.reduce((total, placement) => total + placement.horizontalCount, 0)
    const hardwareLabel = connectorPlacement
      ? connectorPlacement.mountType === 'profile' ? 'ПРОФИЛЬ' : `К ${verticalConnectors}+${horizontalConnectors}`
      : ''
    return [
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${panel.role === 'door' ? '#f59e0b' : '#2563eb'}" stroke-width="7" stroke-linecap="round"/>`,
      hardwareLabel ? `<rect x="${middleX - normalX * 15 - 18}" y="${middleY - normalY * 15 - 6}" width="36" height="11" rx="2" fill="#ffffff" stroke="#bfdbfe" stroke-width=".5"/><text x="${middleX - normalX * 15}" y="${middleY - normalY * 15 + 2}" text-anchor="middle" font-size="6.5" font-weight="700" fill="#1d4ed8">${xml(hardwareLabel)}</text>` : '',
      `<circle cx="${middleX}" cy="${middleY}" r="9" fill="#ffffff" stroke="#0f172a"/><text x="${middleX}" y="${middleY + 3.5}" text-anchor="middle" font-size="9" font-weight="700" fill="#0f172a">${index + 1}</text>`,
    ].join('')
  }
  const coordinates: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  if (['corner', 'corner-plus', 'double-corner', 'slider-corner', 'slider-double'].includes(draft.constructionSketch)) {
    draft.panels.forEach(() => coordinates.push({ x1: 0, y1: 0, x2: 0, y2: 0 }))
    const firstIndexes = draft.openingSegments[0]?.panelIndexes ?? [0]
    const secondIndexes = draft.openingSegments[1]?.panelIndexes ?? []
    firstIndexes.forEach((panelIndex, position) => {
      coordinates[panelIndex] = { x1: 55 + position * (220 / firstIndexes.length), y1: 82, x2: 55 + (position + 1) * (220 / firstIndexes.length), y2: 82 }
    })
    secondIndexes.forEach((panelIndex, position) => {
      coordinates[panelIndex] = { x1: 275, y1: 82 + position * (65 / Math.max(1, secondIndexes.length)), x2: 275, y2: 82 + (position + 1) * (65 / Math.max(1, secondIndexes.length)) }
    })
  } else if (draft.constructionSketch === 'trapezoid') {
    coordinates.push({ x1: 55, y1: 105, x2: 155, y2: 38 }, { x1: 155, y1: 38, x2: 365, y2: 38 }, { x1: 365, y1: 38, x2: 465, y2: 105 })
  } else {
    const segmentWidth = 360 / Math.max(1, draft.panels.length)
    draft.panels.forEach((_, index) => coordinates.push({ x1: 80 + index * segmentWidth, y1: 65, x2: 80 + (index + 1) * segmentWidth, y2: 65 }))
  }
  const drawing = coordinates.map((item, index) => segment(item.x1, item.y1, item.x2, item.y2, index)).join('')
  const openingDimensions = draft.openingSegments.flatMap((opening, openingIndex) => {
    const first = coordinates[opening.panelIndexes[0]]
    const last = coordinates[opening.panelIndexes[opening.panelIndexes.length - 1]]
    if (!first || !last) return []
    const x1 = first.x1
    const y1 = first.y1
    const x2 = last.x2
    const y2 = last.y2
    const length = Math.hypot(x2 - x1, y2 - y1) || 1
    const normalX = -(y2 - y1) / length
    const normalY = (x2 - x1) / length
    const offset = draft.constructionSketch === 'trapezoid' ? 21 : 19 + openingIndex * 3
    const dimX1 = x1 + normalX * offset
    const dimY1 = y1 + normalY * offset
    const dimX2 = x2 + normalX * offset
    const dimY2 = y2 + normalY * offset
    const labelX = (dimX1 + dimX2) / 2 + normalX * 10
    const labelY = (dimY1 + dimY2) / 2 + normalY * 10
    let angle = Math.atan2(dimY2 - dimY1, dimX2 - dimX1) * 180 / Math.PI
    if (angle > 90) angle -= 180
    if (angle < -90) angle += 180
    const label = `${xml(opening.label)} ${Math.round(opening.lengthMm)}`
    const labelWidth = Math.max(58, label.length * 3.8)
    return [`<line x1="${x1}" y1="${y1}" x2="${dimX1}" y2="${dimY1}" class="plan-extension"/><line x1="${x2}" y1="${y2}" x2="${dimX2}" y2="${dimY2}" class="plan-extension"/><line x1="${dimX1}" y1="${dimY1}" x2="${dimX2}" y2="${dimY2}" class="plan-dim" marker-start="url(#plan-arrow)" marker-end="url(#plan-arrow)"/><g transform="rotate(${angle} ${labelX} ${labelY})"><rect x="${labelX - labelWidth / 2}" y="${labelY - 5}" width="${labelWidth}" height="10" fill="#f8fafc"/><text x="${labelX}" y="${labelY + 2}" text-anchor="middle" font-size="6.6" font-weight="700" fill="#111827">${label}</text></g>`]
  }).join('')
  const doorMovements = draft.doorPlacements.flatMap((door) => {
    const item = coordinates[door.panelIndex]
    if (!item) return []
    if (door.motionType === 'sliding') {
      const dx = item.x2 - item.x1
      const dy = item.y2 - item.y1
      const length = Math.hypot(dx, dy) || 1
      const centerX = (item.x1 + item.x2) / 2
      const centerY = (item.y1 + item.y2) / 2
      const direction = door.hingeEdge === 'left' ? -1 : 1
      const startX = centerX + direction * dx / length * 13
      const startY = centerY + direction * dy / length * 13
      const slideX = centerX + direction * dx / length * Math.min(42, length * .32)
      const slideY = centerY + direction * dy / length * Math.min(42, length * .32)
      return [`<line x1="${startX}" y1="${startY}" x2="${slideX}" y2="${slideY}" stroke="#d97706" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#swing-arrow)"/>`]
    }
    const hingeX = door.hingeEdge === 'left' ? item.x1 : item.x2
    const hingeY = door.hingeEdge === 'left' ? item.y1 : item.y2
    const vx = door.hingeEdge === 'left' ? item.x2 - item.x1 : item.x1 - item.x2
    const vy = door.hingeEdge === 'left' ? item.y2 - item.y1 : item.y1 - item.y2
    const length = Math.hypot(vx, vy) || 1
    const radius = Math.min(52, length * .68)
    const direction = door.swingDirection === 'outward' ? 1 : -1
    const swingX = hingeX - direction * vy / length * radius
    const swingY = hingeY + direction * vx / length * radius
    return [`<line x1="${hingeX}" y1="${hingeY}" x2="${swingX}" y2="${swingY}" stroke="#d97706" stroke-width="1.2" stroke-dasharray="4 3" marker-end="url(#swing-arrow)"/><circle cx="${hingeX}" cy="${hingeY}" r="3.5" fill="#fff" stroke="#d97706"/>`]
  }).join('')
  const magneticJoints = draft.magneticPlacements.flatMap((magnetic) => {
    const first = coordinates[magnetic.panelIndex]
    if (!first) return []
    const second = magnetic.pairedPanelIndex === undefined ? undefined : coordinates[magnetic.pairedPanelIndex]
    const firstPoint = magnetic.edge === 'left' ? { x: first.x1, y: first.y1 } : { x: first.x2, y: first.y2 }
    const secondPoint = second && magnetic.pairedEdge
      ? magnetic.pairedEdge === 'left' ? { x: second.x1, y: second.y1 } : { x: second.x2, y: second.y2 }
      : undefined
    const points = secondPoint && Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y) > 12
      ? [firstPoint, secondPoint]
      : [{ x: secondPoint ? (firstPoint.x + secondPoint.x) / 2 : firstPoint.x, y: secondPoint ? (firstPoint.y + secondPoint.y) / 2 : firstPoint.y }]
    return points.map(({ x, y }) => `<circle cx="${x}" cy="${y}" r="7" fill="#fff" stroke="#e11d48" stroke-width="1.4"/><text x="${x}" y="${y + 2.3}" text-anchor="middle" font-size="5.8" font-weight="800" fill="#be123c">М</text>`)
  }).join('')
  const legend = draft.panels.map((panel, index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    const x = 32 + column * 250
    const y = 154 + row * 11
    return `<text x="${x}" y="${y}" font-size="5.8" font-weight="700" fill="#334155">${index + 1}. ${xml(panel.label)}: участок ${Math.round(panel.openingWidthMm)}×${Math.round(panel.openingHeightMm)}; стекло ${Math.round(panel.widthMm)}×${Math.round(panel.heightMm)}</text>`
  }).join('')
  const openingSummary = draft.openingSegments.map((opening) => `${xml(opening.label)} ${Math.round(opening.lengthMm)}`).join(' · ')
  return `<svg width="520" height="190" viewBox="0 0 520 190" xmlns="http://www.w3.org/2000/svg"><defs><marker id="plan-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 5 L10 0 L10 10 Z" fill="#111827"/></marker><marker id="swing-arrow" viewBox="0 0 7 7" refX="5" refY="3.5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L7 3.5 L0 7 Z" fill="#d97706"/></marker></defs><style>.plan-extension{stroke:#94a3b8;stroke-width:.55}.plan-dim{stroke:#111827;stroke-width:.65}</style><rect width="520" height="190" fill="#f8fafc"/><text x="32" y="15" font-size="8.2" font-weight="700" fill="#111827">${openingSummary} · высота ${Math.round(draft.openingHeightMm)} мм</text>${drawing}${openingDimensions}${doorMovements}${magneticJoints}${legend}<path d="M30 176 H490" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 5"/><text x="260" y="187" text-anchor="middle" font-size="8" fill="#64748b">Схема расположения стекол, вид сверху</text></svg>`
}

const headerCell = (text: string): TableCell => ({
  text,
  bold: true,
  fillColor: colors.surface,
  color: colors.heading,
  alignment: 'center',
  margin: [2, 4, 2, 4],
})

const tableLayout = {
  hLineWidth: () => 0.6,
  vLineWidth: () => 0.6,
  hLineColor: () => colors.border,
  vLineColor: () => colors.border,
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 3,
  paddingBottom: () => 3,
}

const cutStockSummary = (item: ProductionCutItem) => {
  const totalCut = item.quantity * item.cutLengthMm
  const totalStock = item.stockPieces * item.stockLengthMm
  return `${mm(totalCut)} / остаток ${mm(Math.max(0, totalStock - totalCut))}`
}

export const buildProductionPdfDefinition = (draft: ProductionPackage): TDocumentDefinitions => {
  const content: Content[] = [
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: 'АМАЛЬГАМА', bold: true, fontSize: 18, color: colors.heading },
            { text: 'Производственный комплект', color: colors.accent, bold: true, fontSize: 10, margin: [0, 2, 0, 0] },
          ],
        },
        {
          width: 185,
          stack: [
            { text: `КП № ${draft.quoteNumber}`, bold: true, alignment: 'right', color: colors.heading },
            { text: `Позиция ${draft.itemIndex + 1}`, alignment: 'right', color: colors.muted, margin: [0, 2, 0, 0] },
            { text: formatDate(), alignment: 'right', color: colors.muted, margin: [0, 2, 0, 0] },
          ],
        },
      ],
    },
    { text: draft.constructionTitle, style: 'title', margin: [0, 18, 0, 4] },
    { text: `${draft.glassLabel} · ${draft.hardwareClass} · ${draft.hardwareColor}`, color: colors.text },
    {
      table: {
        widths: ['*'],
        body: [[{
          text: 'ОБРАБОТКИ ПОСТРОЕНЫ ПО ПРОВЕРЕННЫМ ЧЕРТЕЖАМ ФУРНИТУРЫ',
          bold: true,
          alignment: 'center',
          color: '#166534',
          fillColor: '#f0fdf4',
          margin: [8, 7, 8, 7],
        }]],
      },
      layout: 'noBorders',
      margin: [0, 12, 0, 10],
    },
    { text: 'Схема рассчитанной конструкции', style: 'sectionTitle', margin: [0, 5, 0, 6] },
    { svg: buildTopViewSvg(draft), fit: [535, 185], margin: [0, 10, 0, 0] },
    ...(draft.warnings.length > 0 ? [{
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: 'Основание автоматического расчёта', bold: true, color: colors.warning },
            ...draft.warnings.map((warning) => ({ text: `• ${warning}`, color: colors.text, margin: [0, 3, 0, 0] })),
          ],
          fillColor: colors.warningSoft,
          margin: [8, 7, 8, 7],
        }]],
      },
      layout: 'noBorders',
      margin: [0, 10, 0, 0],
    } as Content] : []),
    { text: 'Монтажные шаблоны фурнитуры', style: 'sectionTitle', margin: [0, 13, 0, 6] },
    {
      table: {
        headerRows: 1,
        widths: [25, 88, '*', 72],
        body: [
          [headerCell('Кол.'), headerCell('Артикул'), headerCell('Проверка'), headerCell('Источник')],
          ...draft.templateChecks.map((check) => [
            { text: String(check.quantity), alignment: 'center' },
            check.sku || '—',
            check.message,
            check.drawingUrl ? {
              text: 'Чертёж AV24',
              link: check.drawingUrl,
              decoration: 'underline',
              color: colors.accent,
              alignment: 'center',
            } : {
              text: check.status === 'not-required' ? 'Не требуется' : 'Нет',
              color: colors.muted,
              alignment: 'center',
            },
          ]),
        ] as TableCell[][],
      },
      layout: tableLayout,
    },
  ]

  draft.panels.forEach((panel, index) => {
    content.push(
      { text: `${index + 1}. ${panel.label}`, style: 'title', pageBreak: 'before', margin: [0, 0, 0, 3] },
      { text: `${draft.glassLabel} · количество ${panel.quantity} шт.`, color: colors.muted },
      { svg: buildPanelSvg(panel), fit: [535, 545], margin: [0, 8, 0, 4] },
      {
        table: {
          widths: [74, 92, '*', 82, 56],
          body: [
            [headerCell('Форма'), headerCell('Участок проёма'), headerCell('Учтённые зазоры'), headerCell('Стекло'), headerCell('Толщина')],
            [
              panel.shape === 'trapezoid' ? 'Трапеция' : 'Прямоугольник',
              { text: `${mm(panel.openingWidthMm)} × ${mm(panel.openingHeightMm)}`, alignment: 'center' },
              panel.clearances.length > 0
                ? panel.clearances.map((item) => {
                  const adjustment = item.widthAdjustmentMm || item.heightAdjustmentMm
                  return `${adjustment > 0 ? '+' : ''}${Math.round(adjustment)} мм - ${item.label} (${item.sourceSku})`
                }).join('\n')
                : 'Не требуются',
              { text: `${mm(panel.widthMm)} × ${mm(panel.heightMm)}`, alignment: 'center', bold: true },
              { text: mm(draft.glassThickness), alignment: 'center', bold: true },
            ],
          ] as TableCell[][],
        },
        layout: tableLayout,
      },
      { text: 'Обработка: закалка, полировка всех кромок.', color: colors.text, margin: [0, 8, 0, 0] },
      ...(panel.notes ? [{ text: `Примечание: ${panel.notes}`, color: colors.muted, margin: [0, 3, 0, 0] } as Content] : []),
    )
  })

  content.push(
    { text: 'Карта напила', style: 'title', pageBreak: 'before', margin: [0, 0, 0, 6] },
    draft.cuts.length > 0 ? {
      table: {
        headerRows: 1,
        widths: [18, '*', 48, 62, 62, 52, 82],
        body: [
          [headerCell('№'), headerCell('Профиль / трек'), headerCell('Кол.'), headerCell('Напил'), headerCell('Хлыст'), headerCell('Хлыстов'), headerCell('Всего / остаток')],
          ...draft.cuts.map((item, index) => [
            { text: String(index + 1), alignment: 'center' },
            { text: item.sku ? `${item.label}\nарт. ${item.sku}` : item.label },
            { text: String(item.quantity), alignment: 'center' },
            { text: mm(item.cutLengthMm), alignment: 'right', bold: true },
            { text: mm(item.stockLengthMm), alignment: 'right' },
            { text: String(item.stockPieces), alignment: 'center', bold: true },
            { text: cutStockSummary(item), alignment: 'right' },
          ]),
        ] as TableCell[][],
      },
      layout: tableLayout,
    } : { text: 'В выбранном составе нет профилей или треков для напила.', color: colors.muted, italics: true },
    { text: 'Ведомость закупки', style: 'title', margin: [0, 22, 0, 6] },
    {
      table: {
        headerRows: 1,
        widths: [20, '*', 95, 50],
        body: [
          [headerCell('№'), headerCell('Наименование'), headerCell('Артикул'), headerCell('Количество')],
          ...draft.purchases.map((item, index) => [
            { text: String(index + 1), alignment: 'center' },
            item.label,
            item.sku || '—',
            { text: `${item.quantity} шт.`, alignment: 'center', bold: true },
          ]),
        ] as TableCell[][],
      },
      layout: tableLayout,
    },
    ...(draft.notes ? [
      { text: 'Общие примечания', style: 'sectionTitle', margin: [0, 16, 0, 5] } as Content,
      { text: draft.notes, color: colors.text } as Content,
    ] : []),
    {
      columns: [
        { width: '*', text: 'Технолог: ____________________', color: colors.heading },
        { width: '*', text: 'Дата: ____________________', alignment: 'right', color: colors.heading },
      ],
      margin: [0, 24, 0, 0],
    },
  )

  return {
    pageSize: 'A4',
    pageMargins: [30, 28, 30, 30],
    info: {
      title: `КП ${draft.quoteNumber} - производственные чертежи`,
      subject: draft.constructionTitle,
      author: 'Амальгама',
    },
    defaultStyle: { font: 'Roboto', fontSize: 8, color: colors.text, lineHeight: 1.15 },
    styles: {
      title: { fontSize: 15, bold: true, color: colors.heading },
      sectionTitle: { fontSize: 10, bold: true, color: colors.heading },
    },
    content,
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `КП ${draft.quoteNumber} · позиция ${draft.itemIndex + 1}`, color: colors.muted },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right', color: colors.muted },
      ],
      fontSize: 7,
      margin: [30, 8, 30, 0],
    }),
  }
}

type PdfWorkerResponse = { blob?: Blob; error?: string }

export type ProductionPdfPreview = {
  fileName: string
  title: string
  documentLabel: string
  url: string
  attachments: Array<{
    fileName: string
    label: string
    url: string
  }>
}

export const createProductionPdfBlob = (draft: ProductionPackage) => new Promise<Blob>((resolve, reject) => {
  const worker = new Worker(new URL('./productionPdf.worker.ts', import.meta.url), { type: 'module' })
  const timeoutId = window.setTimeout(() => {
    worker.terminate()
    reject(new Error('Превышено время формирования производственного PDF'))
  }, pdfLoadTimeoutMs)
  const finish = () => {
    window.clearTimeout(timeoutId)
    worker.terminate()
  }
  worker.onmessage = (event: MessageEvent<PdfWorkerResponse>) => {
    finish()
    if (event.data.blob) resolve(event.data.blob)
    else reject(new Error(event.data.error || 'Не удалось сформировать производственный PDF'))
  }
  worker.onerror = (event) => {
    finish()
    reject(new Error(event.message || 'Не удалось запустить модуль производственного PDF'))
  }
  worker.postMessage(draft)
})

export const shareProductionPdf = async (draft: ProductionPackage): Promise<ProductionPdfPreview> => {
  const blob = await createProductionPdfBlob(draft)
  const dxfBlob = createProductionDxfBlob(draft)
  const baseNumber = draft.quoteNumber.trim().replace(/[^\p{L}\p{N}._-]+/gu, '-')
  return {
    fileName: `Производство-${baseNumber}-позиция-${draft.itemIndex + 1}.pdf`,
    title: `${draft.quoteNumber} · ${draft.constructionTitle}`,
    documentLabel: 'Производственные чертежи',
    url: URL.createObjectURL(blob),
    attachments: [{
      fileName: `Производство-${baseNumber}-позиция-${draft.itemIndex + 1}-1к1.dxf`,
      label: 'Скачать DXF 1:1',
      url: URL.createObjectURL(dxfBlob),
    }],
  }
}
