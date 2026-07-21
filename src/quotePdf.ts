import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import { Capacitor } from '@capacitor/core'
import {
  getConstruction,
  getPublicProductPrice,
  getQuoteItemDetails,
  getQuoteItemQuantity,
  getQuoteItemTitle,
  getQuoteItems,
  getQuoteTotal,
  isMirrorQuoteItem,
  money,
  shortMoney,
  type Quote,
  type QuoteItem,
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
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(date))

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

const brandLogoSvg = (
  '<svg width="64" height="58" viewBox="0 0 64 58" xmlns="http://www.w3.org/2000/svg">'
  + '<path d="M7 50 L28 5 L37 5 L17 50 Z" fill="#1d252c"/>'
  + '<path d="M26 50 L43 12 L59 50 H48 L42 36 H29 L23 50 Z" fill="#5d6a73"/>'
  + '<path d="M12 40 H49" stroke="#ffffff" stroke-width="3" opacity="0.72"/>'
  + '</svg>'
)

const contactIconSvg = (kind: 'phone' | 'web' | 'location') => {
  if (kind === 'phone') {
    return '<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 3.5 L9 8 L7.5 10 C8.7 12.7 10.8 14.8 13.5 16 L15.5 14.5 L20 17 C20 19.2 18.2 21 16 21 C9.4 20.2 3.8 14.6 3 8 C3 5.8 4.8 4 6.5 3.5 Z" fill="none" stroke="#23313b" stroke-width="1.8" stroke-linejoin="round"/></svg>'
  }
  if (kind === 'web') {
    return '<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8.5" fill="none" stroke="#23313b" stroke-width="1.7"/><path d="M3.5 12 H20.5 M12 3.5 C15 6.8 15 17.2 12 20.5 M12 3.5 C9 6.8 9 17.2 12 20.5" fill="none" stroke="#23313b" stroke-width="1.4"/></svg>'
  }
  return '<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 21 C16 16.4 19 13.4 19 9.5 A7 7 0 1 0 5 9.5 C5 13.4 8 16.4 12 21 Z" fill="none" stroke="#23313b" stroke-width="1.7"/><circle cx="12" cy="9.5" r="2.2" fill="none" stroke="#23313b" stroke-width="1.5"/></svg>'
}

const benefitIconSvg = (kind: 'time' | 'warranty' | 'delivery') => {
  if (kind === 'time') {
    return '<svg width="25" height="25" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><circle cx="13" cy="14" r="8" fill="none" stroke="#263640" stroke-width="1.5"/><path d="M13 9 V14 L16.5 16 M10 3 H16 M13 3 V6" fill="none" stroke="#263640" stroke-width="1.5" stroke-linecap="round"/></svg>'
  }
  if (kind === 'warranty') {
    return '<svg width="25" height="25" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M13 3 L21 7 V13 C21 18 17.5 21.5 13 23 C8.5 21.5 5 18 5 13 V7 Z" fill="none" stroke="#263640" stroke-width="1.5"/><path d="M10 13 L12 15 L16.5 10.5" fill="none" stroke="#263640" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  }
  return '<svg width="25" height="25" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M3 8 H16 V19 H3 Z M16 12 H21 L24 16 V19 H16 Z" fill="none" stroke="#263640" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8" cy="20" r="2" fill="#ffffff" stroke="#263640" stroke-width="1.5"/><circle cx="20" cy="20" r="2" fill="#ffffff" stroke="#263640" stroke-width="1.5"/></svg>'
}

const contactRow = (kind: 'phone' | 'web' | 'location', title: string, subtitle?: string): Content => {
  const stack: Content[] = [{ text: title, bold: true, color: pdfColors.heading, fontSize: 8.5 }]
  if (subtitle) stack.push({ text: subtitle, color: pdfColors.muted, fontSize: 7.5, margin: [0, 1, 0, 0] })
  return {
    columns: [
      { width: 20, svg: contactIconSvg(kind), fit: [15, 15], margin: [0, 1, 0, 0] },
      { width: '*', stack },
    ],
    columnGap: 4,
    margin: [0, 0, 0, 6],
  }
}

const productPreviewSvg = (item: QuoteItem) => isMirrorQuoteItem(item)
  ? buildMirrorSvg()
  : buildSketchSvg(getConstruction(defaultCatalog, item.form.constructionId).sketch)

const itemParameterStack = (item: QuoteItem): Content[] => {
  const lines = getQuoteItemDetails(item).filter((line) => line.label.trim() || line.value.trim())
  if (lines.length === 0) return [{ text: '—', color: pdfColors.muted }]
  return lines.map((line) => ({
    text: [
      { text: line.label.trim() ? `${line.label}: ` : '', color: pdfColors.text },
      { text: line.value || '—', bold: true, color: pdfColors.heading },
    ],
    margin: [0, 0, 0, 2],
  }))
}

const tableHeaderCell = (text: string): TableCell => ({
  text,
  bold: true,
  alignment: 'center',
  color: pdfColors.heading,
  fillColor: '#f5f7f8',
  fontSize: 7.5,
  margin: [0, 4, 0, 4],
})

const buildQuoteTableRow = (item: QuoteItem, index: number): TableCell[] => {
  const price = getPublicProductPrice(item.result)
  const quantity = getQuoteItemQuantity(item)
  return [
    { text: String(index + 1), alignment: 'center', color: pdfColors.heading, margin: [0, 21, 0, 0] },
    {
      columns: [
        { width: 48, svg: productPreviewSvg(item), fit: [44, 56], alignment: 'center' },
        { width: '*', text: getQuoteItemTitle(item), alignment: 'center', bold: true, color: pdfColors.heading, margin: [0, 15, 0, 0] },
      ],
      columnGap: 4,
      margin: [0, 4, 0, 4],
    },
    { stack: itemParameterStack(item), margin: [0, 4, 0, 3] },
    { text: String(quantity), alignment: 'center', color: pdfColors.heading, margin: [0, 21, 0, 0] },
    { text: 'шт.', alignment: 'center', color: pdfColors.heading, margin: [0, 21, 0, 0] },
    { text: shortMoney(price), alignment: 'right', bold: true, color: pdfColors.heading, noWrap: true, margin: [0, 21, 0, 0] },
    { text: shortMoney(price * quantity), alignment: 'right', bold: true, color: pdfColors.heading, noWrap: true, margin: [0, 21, 0, 0] },
  ]
}

const benefitBlock = (kind: 'time' | 'warranty' | 'delivery', title: string, value: string): Content => ({
  columns: [
    { width: 28, svg: benefitIconSvg(kind), fit: [22, 22], margin: [0, 1, 0, 0] },
    {
      width: '*',
      stack: [
        { text: title, color: pdfColors.muted, fontSize: 7.5 },
        { text: value, color: pdfColors.heading, fontSize: 8, margin: [0, 1, 0, 0] },
      ],
    },
  ],
  columnGap: 4,
})

export const buildQuotePdfDefinition = (quote: Quote): TDocumentDefinitions => {
  const items = getQuoteItems(quote)
  const hasDiscount = quote.result.discount > 0
  const storedDiscountPercent = Number(quote.form.discountPercent)
  const discountPercent = Number.isFinite(storedDiscountPercent) && storedDiscountPercent > 0
    ? storedDiscountPercent
    : quote.result.subtotal > 0
      ? Math.round((quote.result.discount / quote.result.subtotal) * 10_000) / 100
      : 0
  const discountPercentLabel = discountPercent.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
  const quoteTotal = getQuoteTotal(quote)
  const customerParts = [
    quote.form.clientName ? `Клиент: ${quote.form.clientName}` : '',
    quote.form.clientPhone ? `Телефон: ${quote.form.clientPhone}` : '',
  ].filter(Boolean)
  const summaryRows: TableCell[][] = [
    [
      { text: 'Стоимость изделий', color: pdfColors.text, margin: [0, 3, 0, 3] },
      { text: money(quote.result.product + quote.result.installation), alignment: 'right', color: pdfColors.heading, margin: [0, 3, 0, 3] },
    ],
    [
      { text: 'Доставка', color: pdfColors.text, margin: [0, 3, 0, 3] },
      { text: money(quote.result.delivery), alignment: 'right', color: pdfColors.heading, margin: [0, 3, 0, 3] },
    ],
  ]
  if (hasDiscount) {
    summaryRows.push([
      { text: `Стоимость до скидки (${discountPercentLabel}%)`, color: pdfColors.muted, margin: [0, 3, 0, 3] },
      { text: money(quote.result.subtotal), alignment: 'right', color: pdfColors.muted, decoration: 'lineThrough', margin: [0, 3, 0, 3] },
    ])
  }

  return {
    pageSize: 'A4',
    pageMargins: [30, 28, 30, 28],
    info: {
      title: `${quote.number} - коммерческое предложение`,
      subject: `${items.length} поз. - ${items.map(getQuoteItemTitle).join(', ')}`,
      author: 'Амальгама',
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8,
      color: pdfColors.text,
      lineHeight: 1.15,
    },
    styles: {
      documentTitle: { fontSize: 16, bold: true, color: pdfColors.heading },
      sectionTitle: { fontSize: 10, bold: true, color: pdfColors.heading },
    },
    content: [
      {
        columns: [
          {
            width: '*',
            columns: [
              { width: 46, svg: brandLogoSvg, fit: [40, 40] },
              {
                width: '*',
                stack: [
                  { text: 'АМАЛЬГАМА', bold: true, color: pdfColors.heading, fontSize: 16, margin: [0, 5, 0, 0] },
                  { text: 'зеркала · душевые · мебель', color: pdfColors.heading, fontSize: 7, margin: [0, 2, 0, 0] },
                ],
              },
            ],
            columnGap: 5,
          },
          {
            width: 158,
            stack: [
              contactRow('phone', '8 929 819-16-84', 'WhatsApp / Telegram / Max'),
              contactRow('web', 'amalgama-rostov.ru'),
              contactRow('location', 'Ростов-на-Дону и область'),
            ],
          },
        ],
        columnGap: 16,
      },
      {
        text: 'Коммерческое предложение',
        style: 'documentTitle',
        margin: [0, 3, 0, 0],
      },
      {
        text: `№ ${quote.number} от ${formatPdfDate(quote.createdAt)}`,
        color: pdfColors.heading,
        fontSize: 10,
        margin: [0, 3, 0, 0],
      },
      ...(customerParts.length ? [{ text: customerParts.join(' · '), color: pdfColors.text, margin: [0, 5, 0, 0] } as Content] : []),
      ...(quote.form.note ? [{ text: quote.form.note, color: pdfColors.muted, margin: [0, 3, 0, 0] } as Content] : []),
      {
        text: 'Состав и стоимость заказа',
        style: 'sectionTitle',
        margin: [0, 21, 0, 5],
      },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [20, 120, 142, 34, 38, 56, 58],
          body: [
            [
              tableHeaderCell('№'),
              tableHeaderCell('Наименование'),
              tableHeaderCell('Параметры'),
              tableHeaderCell('Кол-во'),
              tableHeaderCell('Ед. изм.'),
              tableHeaderCell('Цена, ₽'),
              tableHeaderCell('Сумма, ₽'),
            ],
            ...items.map((item, index) => buildQuoteTableRow(item, index)),
          ],
        },
        layout: {
          hLineWidth: () => 0.7,
          vLineWidth: () => 0.7,
          hLineColor: () => '#cfd8de',
          vLineColor: () => '#cfd8de',
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
      },
      {
        columns: [
          { width: '34%', text: '' },
          {
            width: '*',
            stack: [
              {
                table: {
                  widths: ['*', 88],
                  body: summaryRows,
                },
                layout: 'noBorders',
              },
              {
                table: {
                  widths: ['*', 88],
                  body: [[
                    { text: 'Итого к оплате', bold: true, fontSize: 10, color: pdfColors.heading, fillColor: '#e7f0f4', margin: [8, 6, 0, 6] },
                    { text: money(quoteTotal), alignment: 'right', bold: true, fontSize: 12, color: pdfColors.heading, fillColor: '#cfe3ec', margin: [0, 5, 8, 5] },
                  ]],
                },
                layout: 'noBorders',
                margin: [0, 2, 0, 0],
              },
            ],
          },
        ],
        margin: [0, 7, 0, 0],
      },
      {
        columns: [
          { width: '*', stack: [benefitBlock('time', 'Срок изготовления:', '7-10 рабочих дней')] },
          { width: '*', stack: [benefitBlock('warranty', 'Гарантия на изделия:', 'до 2 лет')] },
          { width: '*', stack: [benefitBlock('delivery', 'Доставка и монтаж', 'по Ростову-на-Дону и области')] },
        ],
        columnGap: 14,
        margin: [0, 14, 0, 0],
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 535, y2: 0, lineWidth: 0.8, lineColor: pdfColors.line }],
        margin: [0, 11, 0, 8],
      },
      {
        text: 'Спасибо за обращение!',
        alignment: 'center',
        bold: true,
        color: pdfColors.heading,
        fontSize: 11,
      },
      {
        text: 'Мы ценим ваше доверие и всегда рады помочь!',
        alignment: 'center',
        color: pdfColors.muted,
        fontSize: 8.5,
        margin: [0, 2, 0, 0],
      },
    ],
    footer: (currentPage, pageCount) => ({
      text: pageCount > 1 ? `${quote.number} · ${currentPage} / ${pageCount}` : '',
      alignment: 'right',
      color: pdfColors.muted,
      fontSize: 7,
      margin: [30, 8, 30, 0],
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
