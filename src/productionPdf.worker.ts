import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import { buildProductionPdfDefinition } from './productionPdf'
import type { ProductionPackage } from './productionPlanning'

type PdfWorkerResponse = { blob?: Blob; error?: string }

pdfMake.addVirtualFileSystem(pdfFonts)

self.addEventListener('message', async (event: MessageEvent<ProductionPackage>) => {
  let response: PdfWorkerResponse
  try {
    response = { blob: await pdfMake.createPdf(buildProductionPdfDefinition(event.data)).getBlob() }
  } catch (error) {
    response = { error: error instanceof Error ? error.message : 'Не удалось сформировать производственный PDF' }
  }
  self.postMessage(response)
})
