import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// In dev, /api is proxied to the locally running opamp-backend so no CORS is required.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      '/api': { target: process.env.OPAMP_BACKEND_URL ?? 'http://localhost:8080', changeOrigin: true },
    },
  },
})
