declare module 'pdfmake/build/pdfmake' {
  import pdfMake = require('pdfmake')

  export default pdfMake
}

declare module 'pdfmake/build/vfs_fonts' {
  import type { TVirtualFileSystem } from 'pdfmake/interfaces'

  const fonts: TVirtualFileSystem
  export default fonts
}
