import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import { Capacitor } from '@capacitor/core'
import { getConstruction, money, type Quote } from './calculator'
import { defaultCatalog, type Construction } from './pricing'

const pdfColors = {
  accent: '#2384a6',
  accentSoft: '#e7f5fa',
  heading: '#142331',
  line: '#d7e3eb',
  muted: '#6d7d8a',
  surface: '#f4f8fb',
  text: '#405160',
}

const formatPdfDate = (date: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))

const dimensionRows = (quote: Quote, construction: Construction): Array<[string, string]> =>
  construction.fields.map((field) => [field.label, `${quote.form.dimensions[field.key] ?? 0} мм`])

const buildSketchSvg = (sketch: Construction['sketch']) => {
  const panelCount: Record<Construction['sketch'], number> = {
    single: 1,
    'panel-door': 2,
    panel: 1,
    niche: 1,
    corner: 2,
    'corner-plus': 3,
    'double-corner': 4,
    slider: 2,
    'slider-corner': 3,
    'slider-double': 4,
    trapezoid: 3,
  }
  const count = panelCount[sketch]
  const panelWidth = count > 3 ? 38 : 48
  const gap = 8
  const totalWidth = count * panelWidth + (count - 1) * gap
  const startX = (240 - totalWidth) / 2
  const panels = Array.from({ length: count }, (_, index) => {
    const isShort = sketch === 'trapezoid' && index !== 1
    const height = isShort ? 82 : 106
    const y = isShort ? 34 : 10
    return `<rect x="${startX + index * (panelWidth + gap)}" y="${y}" width="${panelWidth}" height="${height}" rx="5" fill="#c9edf7" fill-opacity="0.82" stroke="#4b9fc0" stroke-width="2"/>`
  }).join('')
  const cornerLine = sketch.includes('corner') || sketch === 'trapezoid'
    ? '<path d="M145 18 L188 118" fill="none" stroke="#526574" stroke-width="3" stroke-linecap="round"/>'
    : ''
  const sliderLine = sketch.includes('slider')
    ? '<path d="M62 94 H174 M86 82 H198" fill="none" stroke="#526574" stroke-width="3" stroke-linecap="round"/>'
    : ''
  const doorLine = sketch.includes('door') || sketch === 'niche'
    ? '<path d="M116 30 L158 74" fill="none" stroke="#526574" stroke-width="3" stroke-linecap="round"/>'
    : ''

  return `<svg width="240" height="140" viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg"><rect width="240" height="140" rx="12" fill="#f4f8fb"/><rect x="28" y="118" width="184" height="10" rx="5" fill="#d7e4ec"/>${panels}${cornerLine}${sliderLine}${doorLine}</svg>`
}

const detailTable = (rows: Array<[string, string]>): Content => ({
  table: {
    widths: ['42%', '*'],
    body: rows.map(([label, value]) => [
      { text: label, color: pdfColors.muted, margin: [0, 4, 0, 4] },
      { text: value, bold: true, color: pdfColors.heading, margin: [0, 4, 0, 4] },
    ]),
  },
  layout: {
    hLineColor: () => pdfColors.line,
    vLineWidth: () => 0,
    paddingLeft: () => 0,
    paddingRight: () => 8,
  },
})

export const buildQuotePdfDefinition = (quote: Quote): TDocumentDefinitions => {
  const construction = getConstruction(defaultCatalog, quote.form.constructionId)
  const clientRows: Array<[string, string]> = [
    ['Клиент', quote.form.clientName || 'Не указан'],
    ['Телефон', quote.form.clientPhone || 'Не указан'],
  ]
  const configurationRows: Array<[string, string]> = [
    ['Конструкция', quote.constructionTitle],
    ...dimensionRows(quote, construction),
    ['Стекло', quote.glassLabel],
    ['Фурнитура', quote.hardwareLabel],
    ['Класс фурнитуры', quote.hardwareClassLabel],
    ['Монтаж', quote.form.installation ? 'Включен' : 'Не включен'],
    [
      'Доставка',
      quote.form.delivery
        ? quote.form.deliveryZone === 'outside'
          ? `За МКАД, ${quote.form.deliveryKm} км`
          : 'В пределах МКАД'
        : 'Не включена',
    ],
  ]
  const clientStack: Content[] = [
    { text: 'Клиент', style: 'sectionTitle', margin: [0, 8, 0, 7] },
    detailTable(clientRows),
  ]
  if (quote.form.note) {
    clientStack.push(
      { text: 'Комментарий', color: pdfColors.muted, margin: [0, 12, 0, 3] },
      { text: quote.form.note, color: pdfColors.heading },
    )
  }
  const costRows: TableCell[][] = quote.result.lines.map((line) => [
    { text: line.label, color: pdfColors.text, margin: [0, 5, 0, 5] },
    { text: money(line.value), alignment: 'right', bold: true, color: pdfColors.heading, margin: [0, 5, 0, 5] },
  ])
  const costTableBody: TableCell[][] = [
    ...costRows,
    [
      { text: 'Итого', bold: true, fontSize: 14, color: '#ffffff', margin: [10, 9, 0, 9], fillColor: pdfColors.accent },
      { text: money(quote.result.total), alignment: 'right', bold: true, fontSize: 16, color: '#ffffff', margin: [0, 8, 10, 8], fillColor: pdfColors.accent },
    ],
  ]

  return {
    pageSize: 'A4',
    pageMargins: [42, 40, 42, 46],
    info: {
      title: `${quote.number} - коммерческое предложение`,
      subject: quote.constructionTitle,
      author: 'Душевые КП',
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: pdfColors.text,
      lineHeight: 1.2,
    },
    styles: {
      documentTitle: { fontSize: 22, bold: true, color: pdfColors.heading },
      sectionTitle: { fontSize: 13, bold: true, color: pdfColors.heading, margin: [0, 14, 0, 7] },
    },
    content: [
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Душевые КП', color: pdfColors.accent, bold: true, fontSize: 12 },
              { text: 'Коммерческое предложение', style: 'documentTitle', margin: [0, 5, 0, 0] },
            ],
          },
          {
            width: 150,
            table: {
              widths: ['*'],
              body: [[{
                stack: [
                  { text: quote.number, bold: true, fontSize: 13, color: pdfColors.heading },
                  { text: formatPdfDate(quote.createdAt), color: pdfColors.muted, margin: [0, 4, 0, 0] },
                ],
                fillColor: pdfColors.accentSoft,
                margin: [10, 8, 10, 8],
              }]],
            },
            layout: 'noBorders',
          },
        ],
        columnGap: 18,
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 511, y2: 0, lineWidth: 1, lineColor: pdfColors.line }],
        margin: [0, 18, 0, 4],
      },
      {
        columns: [
          {
            width: '*',
            stack: clientStack,
          },
          {
            width: 205,
            stack: [
              { svg: buildSketchSvg(construction.sketch), width: 190, alignment: 'center' },
              { text: construction.shortTitle, alignment: 'center', bold: true, color: pdfColors.heading, margin: [0, 5, 0, 0] },
            ],
          },
        ],
        columnGap: 24,
        margin: [0, 8, 0, 0],
      },
      { text: 'Комплектация', style: 'sectionTitle' },
      detailTable(configurationRows),
      { text: 'Стоимость', style: 'sectionTitle' },
      {
        table: {
          widths: ['*', 130],
          body: costTableBody,
        },
        layout: {
          hLineColor: () => pdfColors.line,
          vLineWidth: () => 0,
          paddingLeft: () => 0,
          paddingRight: () => 0,
        },
      },
      {
        text: 'Итоговая стоимость рассчитана по выбранной комплектации и указанным размерам.',
        color: pdfColors.muted,
        fontSize: 9,
        margin: [0, 12, 0, 0],
      },
    ],
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: quote.number, color: pdfColors.muted, fontSize: 8 },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right', color: pdfColors.muted, fontSize: 8 },
      ],
      margin: [42, 12, 42, 0],
    }),
  }
}

const loadPdfMake = async () => {
  const [pdfMakeModule, fontModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ])
  pdfMakeModule.default.addVirtualFileSystem(fontModule.default)
  return pdfMakeModule.default
}

export const createQuotePdfBlob = async (quote: Quote) => {
  const pdfMake = await loadPdfMake()
  return pdfMake.createPdf(buildQuotePdfDefinition(quote)).getBlob()
}

const pdfFileName = (quote: Quote) => `${quote.number.replace(/[^\p{L}\p{N}._-]+/gu, '-')}.pdf`

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать PDF'))
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.readAsDataURL(blob)
  })

const shareNativePdf = async (blob: Blob, fileName: string, title: string) => {
  const [{ Directory, Filesystem }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  const path = `quotes/${fileName}`
  const file = await Filesystem.writeFile({
    path,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
    recursive: true,
  })

  try {
    await Share.share({ title, files: [file.uri] })
  } finally {
    await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => undefined)
  }
}

export const shareQuotePdf = async (quote: Quote) => {
  const blob = await createQuotePdfBlob(quote)
  const fileName = pdfFileName(quote)
  const title = `${quote.number} - коммерческое предложение`

  if (Capacitor.isNativePlatform()) {
    await shareNativePdf(blob, fileName, title)
    return
  }

  const file = new File([blob], fileName, { type: 'application/pdf' })
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  if (isIos && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title,
      })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }

  downloadBlob(blob, fileName)
}
