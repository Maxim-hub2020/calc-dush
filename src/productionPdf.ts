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
  if (operation.widthMm > 0 || operation.heightMm > 0) return `${mm(operation.widthMm)} × ${mm(operation.heightMm)}`
  return 'Размер по шаблону'
}

const buildPanelSvg = (panel: ProductionPanel) => {
  const width = Math.max(1, panel.widthMm)
  const height = Math.max(1, panel.heightMm)
  const maxW = 380
  const maxH = 220
  const scale = Math.min(maxW / width, maxH / height)
  const drawW = width * scale
  const drawH = height * scale
  const x = (520 - drawW) / 2
  const y = 45 + (maxH - drawH) / 2
  const topWidth = Math.min(width, Math.max(1, panel.topWidthMm || width))
  const topInset = panel.shape === 'trapezoid' ? (width - topWidth) * scale / 2 : 0
  const panelPath = panel.shape === 'trapezoid'
    ? `M ${x} ${y + drawH} L ${x + topInset} ${y} L ${x + drawW - topInset} ${y} L ${x + drawW} ${y + drawH} Z`
    : `M ${x} ${y} H ${x + drawW} V ${y + drawH} H ${x} Z`
  const operations = panel.operations.map((operation, index) => {
    const px = x + Math.min(width, operation.xMm) * scale
    const py = y + drawH - Math.min(height, operation.yMm) * scale
    if (operation.kind === 'hole') {
      const radius = Math.max(4, operation.diameterMm * scale / 2)
      return `<circle cx="${px}" cy="${py}" r="${radius}" fill="#ffffff" stroke="#dc2626" stroke-width="2"/><text x="${px + radius + 5}" y="${py - 5}" font-size="11" fill="#991b1b">${index + 1}</text>`
    }
    const opWidth = Math.max(12, operation.widthMm * scale)
    const opHeight = Math.max(12, operation.heightMm * scale)
    return `<rect x="${px}" y="${py - opHeight}" width="${opWidth}" height="${opHeight}" fill="#fff7ed" stroke="#c2410c" stroke-width="2"/><text x="${px + opWidth + 5}" y="${py - 5}" font-size="11" fill="#9a3412">${index + 1}</text>`
  }).join('')

  return `<svg width="520" height="320" viewBox="0 0 520 320" xmlns="http://www.w3.org/2000/svg">
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/></marker></defs>
    <rect width="520" height="320" fill="#ffffff"/>
    <path d="${panelPath}" fill="#e0f2fe" fill-opacity="0.62" stroke="#0f172a" stroke-width="2"/>
    ${operations}
    <line x1="${x}" y1="${y + drawH + 28}" x2="${x + drawW}" y2="${y + drawH + 28}" stroke="#64748b" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
    <text x="260" y="${y + drawH + 45}" text-anchor="middle" font-size="13" font-weight="700" fill="#0f172a">${Math.round(width)} мм</text>
    <line x1="${x - 28}" y1="${y}" x2="${x - 28}" y2="${y + drawH}" stroke="#64748b" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
    <text x="${x - 42}" y="${y + drawH / 2}" text-anchor="middle" font-size="13" font-weight="700" fill="#0f172a" transform="rotate(-90 ${x - 42} ${y + drawH / 2})">${Math.round(height)} мм</text>
    ${panel.shape === 'trapezoid' ? `<text x="260" y="31" text-anchor="middle" font-size="12" fill="#334155">верх ${Math.round(topWidth)} мм</text>` : ''}
  </svg>`
}

const buildTopViewSvg = (draft: ProductionPackage) => {
  const labels = draft.panels.map((panel, index) => `${index + 1}. ${xml(panel.label)} ${Math.round(panel.widthMm)}`)
  const line = (x1: number, y1: number, x2: number, y2: number, index: number) => (
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2563eb" stroke-width="7" stroke-linecap="round"/><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 10}" text-anchor="middle" font-size="12" font-weight="700" fill="#1e3a8a">${labels[index] ?? index + 1}</text>`
  )
  let drawing = ''
  if (['corner', 'corner-plus', 'double-corner', 'slider-corner', 'slider-double'].includes(draft.constructionSketch)) {
    drawing = line(70, 145, 250, 145, 0) + line(250, 145, 250, 35, 1)
    if (draft.panels[2]) drawing += line(250, 35, 360, 35, 2)
    if (draft.panels[3]) drawing += line(360, 35, 445, 35, 3)
  } else if (draft.constructionSketch === 'trapezoid') {
    drawing = line(70, 145, 175, 55, 0) + line(175, 55, 345, 55, 1) + line(345, 55, 450, 145, 2)
  } else {
    const segmentWidth = 360 / Math.max(1, draft.panels.length)
    drawing = draft.panels.map((_, index) => line(80 + index * segmentWidth, 105, 80 + (index + 1) * segmentWidth, 105, index)).join('')
  }
  return `<svg width="520" height="180" viewBox="0 0 520 180" xmlns="http://www.w3.org/2000/svg"><rect width="520" height="180" fill="#f8fafc"/><path d="M40 160 H480" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 5"/>${drawing}<text x="260" y="171" text-anchor="middle" font-size="10" fill="#64748b">Схема расположения стекол, вид сверху</text></svg>`
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

const operationTable = (panel: ProductionPanel): Content => {
  if (panel.operations.length === 0) {
    return { text: 'Сверления и вырезы не заданы.', italics: true, color: colors.muted, margin: [0, 4, 0, 0] }
  }
  return {
    table: {
      headerRows: 1,
      widths: [18, 64, '*', 54, 54, 74],
      body: [
        [headerCell('№'), headerCell('Тип'), headerCell('Назначение'), headerCell('X'), headerCell('Y'), headerCell('Размер')],
        ...panel.operations.map((operation, index) => [
          { text: String(index + 1), alignment: 'center' },
          operationKindLabel[operation.kind],
          operation.label,
          { text: mm(operation.xMm), alignment: 'right' },
          { text: mm(operation.yMm), alignment: 'right' },
          { text: operationSize(operation), alignment: 'right' },
        ]),
      ] as TableCell[][],
    },
    layout: tableLayout,
    margin: [0, 6, 0, 0],
  }
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
          text: 'РАЗМЕРЫ И ОБРАБОТКИ ПРОВЕРЕНЫ ТЕХНОЛОГОМ',
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
    { text: 'Исходная схема', style: 'sectionTitle', margin: [0, 5, 0, 6] },
    ...(draft.referenceImageDataUrl ? [{ image: draft.referenceImageDataUrl, fit: [535, 285], alignment: 'center' } as Content] : []),
    { svg: buildTopViewSvg(draft), fit: [535, 185], margin: [0, 10, 0, 0] },
    ...(draft.analysisSummary ? [{ text: draft.analysisSummary, color: colors.text, margin: [0, 8, 0, 0] } as Content] : []),
    ...(draft.warnings.length > 0 ? [{
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: 'Контрольные замечания', bold: true, color: colors.warning },
            ...draft.warnings.map((warning) => ({ text: `• ${warning}`, color: colors.text, margin: [0, 3, 0, 0] })),
          ],
          fillColor: colors.warningSoft,
          margin: [8, 7, 8, 7],
        }]],
      },
      layout: 'noBorders',
      margin: [0, 10, 0, 0],
    } as Content] : []),
  ]

  draft.panels.forEach((panel, index) => {
    content.push(
      { text: `${index + 1}. ${panel.label}`, style: 'title', pageBreak: 'before', margin: [0, 0, 0, 3] },
      { text: `${draft.glassLabel} · количество ${panel.quantity} шт.`, color: colors.muted },
      { svg: buildPanelSvg(panel), fit: [535, 330], margin: [0, 12, 0, 0] },
      { text: 'Координаты обработок: X от левого края, Y от нижнего края.', alignment: 'center', color: colors.muted, fontSize: 7.5, margin: [0, 0, 0, 7] },
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
      { text: 'Сверления и вырезы', style: 'sectionTitle', margin: [0, 12, 0, 0] },
      operationTable(panel),
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
