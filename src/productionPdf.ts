import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
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
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const operation = group.operation
  const title = `${group.id} · ${operation.sourceSku || operationKindLabel[operation.kind]}`
  const cx = x + width / 2
  const cy = y + 58
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
    const edgeOffset = Math.round(Math.min(operation.xMm, Math.max(0, panelWidthMm - operation.xMm)))
    if (edgeOffset > 0) drawing += `<text x="${x + 10}" y="${y + height - 12}" class="detail-note">ось от кромки ${edgeOffset} мм</text>`
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

  return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" class="detail-box"/><text x="${x + 9}" y="${y + 17}" class="detail-title">${xml(title)}</text>${drawing}<text x="${x + 9}" y="${y + height - 2}" class="detail-note">${xml(operationSize(operation))}</text></g>`
}

const buildPanelSvg = (panel: ProductionPanel) => {
  const width = Math.max(1, panel.widthMm)
  const height = Math.max(1, panel.heightMm)
  const maxW = 285
  const maxH = 430
  const scale = Math.min(maxW / width, maxH / height)
  const drawW = width * scale
  const drawH = height * scale
  const x = 52 + (maxW - drawW) / 2
  const y = 48 + (maxH - drawH) / 2
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
      return `<circle cx="${number(px)}" cy="${number(py)}" r="${number(radius)}" class="cut"/>${centerMark(px, py, 5)}<text x="${number(px + radius + 5)}" y="${number(py - 5)}" class="node-label">${groupByOperation.get(operation.id)}</text>`
    }
    return `<path d="${edgeCutPath(operation, x, y, drawW, drawH, scale)}" class="cut"/><text x="${number(px)}" y="${number(py - operation.heightMm * scale / 2 - 5)}" class="node-label">${groupByOperation.get(operation.id)}</text>`
  }).join('')

  const xDimensionEntries = [...new Map(panel.operations.map((operation) => {
    const side = operation.xMm <= width / 2 ? 'left' : 'right'
    const offset = Math.round(side === 'left' ? operation.xMm : width - operation.xMm)
    return [`${side}-${offset}`, { side, offset, position: operation.xMm }]
  })).values()]
  const xDimensions = xDimensionEntries
    .slice(0, 5)
    .map(({ side, offset, position }, index) => {
      const px = x + position * scale
      const edgePosition = side === 'left' ? x : x + drawW
      const dimY = y - 14 - index * 10
      return `<line x1="${edgePosition}" y1="${y}" x2="${edgePosition}" y2="${dimY}" class="extension"/><line x1="${px}" y1="${y}" x2="${px}" y2="${dimY}" class="extension"/>${dimensionLine(edgePosition, dimY, px, dimY, `${offset}`)}`
    }).join('')
  const yDimensionEntries = [...new Map(panel.operations.map((operation) => {
    const side = operation.yMm <= height / 2 ? 'bottom' : 'top'
    const offset = Math.round(side === 'bottom' ? operation.yMm : height - operation.yMm)
    return [`${side}-${offset}`, { side, offset, position: operation.yMm }]
  })).values()]
  const yDimensions = yDimensionEntries
    .slice(0, 7)
    .map(({ side, offset, position }, index) => {
      const py = y + drawH - position * scale
      const edgePosition = side === 'bottom' ? y + drawH : y
      const dimX = x + drawW + 13 + index * 9
      return `<line x1="${x + drawW}" y1="${edgePosition}" x2="${dimX}" y2="${edgePosition}" class="extension"/><line x1="${x + drawW}" y1="${py}" x2="${dimX}" y2="${py}" class="extension"/>${dimensionLine(dimX, edgePosition, dimX, py, `${offset}`, true)}`
    }).join('')
  const detailWidth = 176
  const detailHeight = Math.min(118, Math.max(92, 390 / Math.max(1, groups.length)))
  const details = groups.slice(0, 4).map((group, index) => buildDetailSvg(group, panel.widthMm, 350, 54 + index * (detailHeight + 7), detailWidth, detailHeight)).join('')

  return `<svg width="535" height="545" viewBox="0 0 535 545" xmlns="http://www.w3.org/2000/svg">
    <defs><marker id="dim-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M 0 5 L 10 0 L 10 10 Z" fill="#111827"/></marker></defs>
    <style>.panel{fill:#f0f9ff;stroke:#111827;stroke-width:1.4}.cut{fill:#fff;stroke:#111827;stroke-width:1.35}.center{fill:none;stroke:#64748b;stroke-width:.7;stroke-dasharray:3 2}.dim{stroke:#111827;stroke-width:.7}.extension{stroke:#64748b;stroke-width:.55}.dim-text{font:8px Roboto,Arial,sans-serif;fill:#111827}.node-label{font:bold 8px Roboto,Arial,sans-serif;fill:#1d4ed8}.detail-box{fill:#fff;stroke:#94a3b8;stroke-width:.7}.detail-title{font:bold 8px Roboto,Arial,sans-serif;fill:#111827}.detail-text{font:8px Roboto,Arial,sans-serif;fill:#111827}.detail-note{font:6.8px Roboto,Arial,sans-serif;fill:#475569}.leader{fill:none;stroke:#111827;stroke-width:.7}</style>
    <rect width="535" height="545" fill="#ffffff"/>
    <text x="12" y="18" class="detail-title">КОНТУР СТЕКЛА И ПРИВЯЗКИ ОБРАБОТОК</text>
    <text x="523" y="18" class="detail-note" text-anchor="end">Все размеры в миллиметрах</text>
    <path d="${panelPath}" class="panel"/>
    ${operations}
    ${xDimensions}${yDimensions}
    <line x1="${x}" y1="${y + drawH}" x2="${x}" y2="${y + drawH + 27}" class="extension"/><line x1="${x + drawW}" y1="${y + drawH}" x2="${x + drawW}" y2="${y + drawH + 27}" class="extension"/>
    ${dimensionLine(x, y + drawH + 22, x + drawW, y + drawH + 22, `${Math.round(width)}`)}
    <line x1="${x}" y1="${y}" x2="${x - 30}" y2="${y}" class="extension"/><line x1="${x}" y1="${y + drawH}" x2="${x - 30}" y2="${y + drawH}" class="extension"/>
    ${dimensionLine(x - 25, y, x - 25, y + drawH, `${Math.round(height)}`, true)}
    ${panel.shape === 'trapezoid' ? `<text x="${x + drawW / 2}" y="${y - 8}" text-anchor="middle" class="dim-text">верх ${Math.round(topWidth)}</text>` : ''}
    ${details}
    <rect x="8" y="510" width="519" height="27" class="detail-box"/>
    <text x="17" y="522" class="detail-title">${xml(panel.label)} · ${panel.role === 'door' ? 'дверное стекло' : 'неподвижное стекло'} · ${Math.round(panel.widthMm)} × ${Math.round(panel.heightMm)} мм · ${panel.quantity} шт.</text>
    <text x="17" y="532" class="detail-note">Обработка кромок: полировка. Стекло: закалённое. Контуры вырезов показаны на детали и увеличены в узлах справа.</text>
  </svg>`
}

const buildTopViewSvg = (draft: ProductionPackage) => {
  const line = (x1: number, y1: number, x2: number, y2: number, index: number) => (
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2563eb" stroke-width="7" stroke-linecap="round"/><circle cx="${(x1 + x2) / 2}" cy="${(y1 + y2) / 2 - 10}" r="9" fill="#ffffff" stroke="#2563eb"/><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6.5}" text-anchor="middle" font-size="10" font-weight="700" fill="#1e3a8a">${index + 1}</text>`
  )
  let drawing = ''
  if (['corner', 'corner-plus', 'double-corner', 'slider-corner', 'slider-double'].includes(draft.constructionSketch)) {
    drawing = line(70, 95, 250, 95, 0) + line(250, 95, 250, 25, 1)
    if (draft.panels[2]) drawing += line(250, 25, 360, 25, 2)
    if (draft.panels[3]) drawing += line(360, 25, 445, 25, 3)
  } else if (draft.constructionSketch === 'trapezoid') {
    drawing = line(70, 95, 175, 30, 0) + line(175, 30, 345, 30, 1) + line(345, 30, 450, 95, 2)
  } else {
    const segmentWidth = 360 / Math.max(1, draft.panels.length)
    drawing = draft.panels.map((_, index) => line(80 + index * segmentWidth, 65, 80 + (index + 1) * segmentWidth, 65, index)).join('')
  }
  const legend = draft.panels.map((panel, index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    return `<text x="${42 + column * 245}" y="${127 + row * 15}" font-size="9" fill="#334155">${index + 1}. ${xml(panel.label)} · ${Math.round(panel.widthMm)} мм</text>`
  }).join('')
  return `<svg width="520" height="180" viewBox="0 0 520 180" xmlns="http://www.w3.org/2000/svg"><rect width="520" height="180" fill="#f8fafc"/>${drawing}${legend}<path d="M40 163 H480" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 5"/><text x="260" y="175" text-anchor="middle" font-size="9" fill="#64748b">Схема расположения стекол, вид сверху</text></svg>`
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
          widths: ['*', '*', '*', '*'],
          body: [
            [headerCell('Форма'), headerCell('Ширина'), headerCell('Высота'), headerCell('Толщина')],
            [
              panel.shape === 'trapezoid' ? 'Трапеция' : 'Прямоугольник',
              { text: mm(panel.widthMm), alignment: 'center', bold: true },
              { text: mm(panel.heightMm), alignment: 'center', bold: true },
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
  const baseNumber = draft.quoteNumber.trim().replace(/[^\p{L}\p{N}._-]+/gu, '-')
  return {
    fileName: `Производство-${baseNumber}-позиция-${draft.itemIndex + 1}.pdf`,
    title: `${draft.quoteNumber} · ${draft.constructionTitle}`,
    documentLabel: 'Производственные чертежи',
    url: URL.createObjectURL(blob),
  }
}
