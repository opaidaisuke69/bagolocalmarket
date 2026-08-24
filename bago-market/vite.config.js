import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: (path) => '/BagoMarketPlace/bago-market/server/api' + path.slice(4)
      },
      '/uploads': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: (path) => '/BagoMarketPlace/bago-market/server' + path
      }
    }
  }
})
