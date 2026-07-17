import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import type { Quote } from './calculator'
import { buildQuotePdfDefinition } from './quotePdf'

type PdfWorkerResponse = {
  blob?: Blob
  error?: string
}

pdfMake.addVirtualFileSystem(pdfFonts)

self.addEventListener('message', async (event: MessageEvent<Quote>) => {
  let response: PdfWorkerResponse

  try {
    response = { blob: await pdfMake.createPdf(buildQuotePdfDefinition(event.data)).getBlob() }
  } catch (error) {
    response = { error: error instanceof Error ? error.message : 'Не удалось сформировать PDF' }
  }

  self.postMessage(response)
})
