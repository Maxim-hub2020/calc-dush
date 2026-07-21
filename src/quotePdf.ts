import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import { Capacitor } from '@capacitor/core'
import {
  getConstruction,
  getQuoteItemTitle,
  getQuoteItems,
  isMirrorQuoteItem,
  money,
  type MirrorQuoteItem,
  type Quote,
  type QuoteItem,
  type ShowerQuoteItem,
} from './calculator'
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

const pdfLoadTimeoutMs = 20_000

const formatPdfDate = (date: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))

const dimensionRows = (quote: ShowerQuoteItem, construction: Construction): Array<[string, string]> =>
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

const buildMirrorSvg = () => (
  '<svg width="240" height="140" viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">'
  + '<rect width="240" height="140" rx="12" fill="#f4f8fb"/>'
  + '<rect x="48" y="15" width="144" height="110" rx="8" fill="#dff3f8" stroke="#4b9fc0" stroke-width="3"/>'
  + '<path d="M64 34 L96 22 M63 54 L128 23" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.82"/>'
  + '<rect x="58" y="126" width="124" height="5" rx="2.5" fill="#d7e4ec"/>'
  + '</svg>'
)

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

const showerConfigurationRows = (item: ShowerQuoteItem, construction: Construction): Array<[string, string]> => {
  const rows: Array<[string, string]> = [
    ['Конструкция', item.constructionTitle],
    ...dimensionRows(item, construction),
    ['Стекло', item.glassLabel],
    ['Фурнитура', item.hardwareLabel],
    ['Класс фурнитуры', item.hardwareClassLabel],
    [
      'Доставка',
      item.form.delivery
        ? item.form.deliveryZone === 'outside'
          ? `За городом, ${item.form.deliveryKm} км`
          : 'По городу'
        : 'Не включена',
    ],
  ]
  if (item.result.discount > 0) rows.push(['Скидка', `${item.form.discountPercent}%`])
  return rows
}

const itemPriceCell = (item: QuoteItem): TableCell => item.result.discount > 0
  ? {
      stack: [
        {
          text: money(item.result.subtotal),
          alignment: 'right',
          color: pdfColors.muted,
          decoration: 'lineThrough',
          fontSize: 9,
        },
        { text: money(item.result.total), alignment: 'right', bold: true, color: pdfColors.heading, margin: [0, 2, 0, 0] },
      ],
      fillColor: pdfColors.accentSoft,
      margin: [8, 4, 8, 4],
    }
  : {
      text: money(item.result.total),
      alignment: 'right',
      bold: true,
      color: pdfColors.heading,
      fillColor: pdfColors.accentSoft,
      margin: [8, 7, 8, 7],
    }

const buildShowerQuoteItemBlock = (item: ShowerQuoteItem, index: number): Content => {
  const construction = getConstruction(defaultCatalog, item.form.constructionId)

  return {
    unbreakable: true,
    margin: [0, 12, 0, 2],
    stack: [
      {
        table: {
          widths: [78, '*', 118],
          body: [[
            { text: `Позиция ${index + 1}`, bold: true, color: pdfColors.accent, fillColor: pdfColors.accentSoft, margin: [8, 7, 8, 7] },
            { text: item.constructionTitle, bold: true, color: pdfColors.heading, fillColor: pdfColors.accentSoft, margin: [8, 7, 8, 7] },
            itemPriceCell(item),
          ]],
        },
        layout: 'noBorders',
      },
      {
        columns: [
          { width: '*', stack: [detailTable(showerConfigurationRows(item, construction))] },
          {
            width: 160,
            stack: [
              { svg: buildSketchSvg(construction.sketch), width: 145, alignment: 'center' },
              { text: construction.shortTitle, alignment: 'center', bold: true, color: pdfColors.heading, margin: [0, 3, 0, 0] },
            ],
          },
        ],
        columnGap: 18,
        margin: [0, 8, 0, 0],
      },
    ],
  }
}

const mirrorConfigurationRows = (item: MirrorQuoteItem): Array<[string, string]> => {
  const rows: Array<[string, string]> = [
    ['Изделие', item.mirrorTitle],
    ['Размер', `${item.form.width} × ${item.form.height} мм`],
    ['Материал', item.materialLabel],
    ...item.serviceLines
      .filter((line) => line.visibleInQuote)
      .map((line): [string, string] => [
        line.label,
        `${line.quantity.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${line.unitLabel}`,
      ]),
  ]
  if (item.result.discount > 0) rows.push(['Скидка', `${item.form.discountPercent}%`])
  return rows
}

const buildMirrorQuoteItemBlock = (item: MirrorQuoteItem, index: number): Content => ({
  unbreakable: true,
  margin: [0, 12, 0, 2],
  stack: [
    {
      table: {
        widths: [78, '*', 118],
        body: [[
          { text: `Позиция ${index + 1}`, bold: true, color: pdfColors.accent, fillColor: pdfColors.accentSoft, margin: [8, 7, 8, 7] },
          { text: item.mirrorTitle, bold: true, color: pdfColors.heading, fillColor: pdfColors.accentSoft, margin: [8, 7, 8, 7] },
          itemPriceCell(item),
        ]],
      },
      layout: 'noBorders',
    },
    {
      columns: [
        { width: '*', stack: [detailTable(mirrorConfigurationRows(item))] },
        {
          width: 160,
          stack: [
            { svg: buildMirrorSvg(), width: 145, alignment: 'center' },
            { text: 'Зеркало', alignment: 'center', bold: true, color: pdfColors.heading, margin: [0, 3, 0, 0] },
          ],
        },
      ],
      columnGap: 18,
      margin: [0, 8, 0, 0],
    },
  ],
})

const buildQuoteItemBlock = (item: QuoteItem, index: number): Content => (
  isMirrorQuoteItem(item)
    ? buildMirrorQuoteItemBlock(item, index)
    : buildShowerQuoteItemBlock(item, index)
)

export const buildQuotePdfDefinition = (quote: Quote): TDocumentDefinitions => {
  const items = getQuoteItems(quote)
  const clientRows: Array<[string, string]> = [
    ['Клиент', quote.form.clientName || 'Не указан'],
    ['Телефон', quote.form.clientPhone || 'Не указан'],
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
  const hasDiscount = quote.result.discount > 0
  const costRows: TableCell[][] = [
    [
      { text: 'Стоимость изделия', color: pdfColors.text, margin: [0, 5, 0, 5] },
      { text: money(quote.result.product + quote.result.installation), alignment: 'right', bold: true, color: pdfColors.heading, margin: [0, 5, 0, 5] },
    ],
    [
      { text: 'Доставка', color: pdfColors.text, margin: [0, 5, 0, 5] },
      { text: money(quote.result.delivery), alignment: 'right', bold: true, color: pdfColors.heading, margin: [0, 5, 0, 5] },
    ],
  ]
  const discountRow: TableCell[] | null = hasDiscount ? [
    { text: `Стоимость до скидки ${quote.form.discountPercent}%`, color: pdfColors.muted, margin: [0, 6, 0, 6] },
    {
      text: money(quote.result.subtotal),
      alignment: 'right',
      bold: true,
      color: pdfColors.muted,
      decoration: 'lineThrough',
      margin: [0, 6, 0, 6],
    },
  ] : null
  const costTableBody: TableCell[][] = [
    ...costRows,
    ...(discountRow ? [discountRow] : []),
    [
      { text: hasDiscount ? 'Итого со скидкой' : 'Итого', bold: true, fontSize: 14, color: '#ffffff', margin: [10, 9, 0, 9], fillColor: pdfColors.accent },
      { text: money(quote.result.total), alignment: 'right', bold: true, fontSize: 16, color: '#ffffff', margin: [0, 8, 10, 8], fillColor: pdfColors.accent },
    ],
  ]

  return {
    pageSize: 'A4',
    pageMargins: [42, 40, 42, 46],
    info: {
      title: `${quote.number} - коммерческое предложение`,
      subject: `${items.length} поз. - ${items.map(getQuoteItemTitle).join(', ')}`,
      author: 'Амальгама',
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
              { text: 'Амальгама', color: pdfColors.accent, bold: true, fontSize: 12 },
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
                  { text: `${items.length} поз.`, color: pdfColors.accent, bold: true, margin: [0, 4, 0, 0] },
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
        stack: clientStack,
        margin: [0, 4, 0, 0],
      },
      ...items.map((item, index) => buildQuoteItemBlock(item, index)),
      {
        unbreakable: true,
        stack: [
          { text: 'Итого по предложению', style: 'sectionTitle' },
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
        ],
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

type PdfWorkerResponse = {
  blob?: Blob
  error?: string
}

export const createQuotePdfBlob = (quote: Quote) =>
  new Promise<Blob>((resolve, reject) => {
    const worker = new Worker(new URL('./quotePdf.worker.ts', import.meta.url), { type: 'module' })
    const timeoutId = window.setTimeout(() => {
      worker.terminate()
      reject(new Error('Превышено время формирования PDF'))
    }, pdfLoadTimeoutMs)

    const finish = () => {
      window.clearTimeout(timeoutId)
      worker.terminate()
    }

    worker.onmessage = (event: MessageEvent<PdfWorkerResponse>) => {
      finish()
      if (event.data.blob) {
        resolve(event.data.blob)
        return
      }
      reject(new Error(event.data.error || 'Не удалось сформировать PDF'))
    }

    worker.onerror = (event) => {
      finish()
      reject(new Error(event.message || 'Не удалось запустить модуль PDF'))
    }

    worker.postMessage(quote)
  })

const pdfFileName = (quote: Quote) => `${quote.number.replace(/[^\p{L}\p{N}._-]+/gu, '-')}.pdf`

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

export type QuotePdfPreview = {
  fileName: string
  title: string
  url: string
}

export const shareQuotePdf = async (quote: Quote): Promise<QuotePdfPreview | null> => {
  const fileName = pdfFileName(quote)
  const title = `${quote.number} - коммерческое предложение`
  const isNative = Capacitor.isNativePlatform()
  const blob = await createQuotePdfBlob(quote)

  if (isNative) {
    await shareNativePdf(blob, fileName, title)
    return null
  }

  return { fileName, title, url: URL.createObjectURL(blob) }
}
