import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfmake/build/vfs_fonts')) return 'pdfmake-fonts-v0.3.11'
          if (id.includes('/node_modules/pdfmake/')) return 'pdfmake-v0.3.11'
        },
        chunkFileNames(chunkInfo) {
          if (chunkInfo.name === 'pdfmake-v0.3.11' || chunkInfo.name === 'pdfmake-fonts-v0.3.11') {
            return 'assets/[name].js'
          }
          return 'assets/[name]-[hash].js'
        },
      },
    },
  },
})
