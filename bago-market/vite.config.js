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
        // Disable body buffering so large multipart/form-data uploads pass through
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Forward the raw body for multipart uploads
            if (req.headers['content-type']?.includes('multipart/form-data')) {
              // Remove content-length override — let the upstream handle it
              proxyReq.removeHeader('content-length');
            }
          });
        },
        rewrite: (path) => '/BagoMarketPlace/bago-market/server/api' + path.slice(4)
      },
      '/uploads': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: (path) => '/BagoMarketPlace/bago-market/server' + path
      },
      '/server': {
        target: 'http://localhost',
        changeOrigin: true,
        rewrite: (path) => '/BagoMarketPlace/bago-market' + path
      }
    }
  }
})
