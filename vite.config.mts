import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: { chunkSizeWarningLimit: 900 },
  server: {
    port: 5173,
    // Accessible depuis les autres appareils du réseau local (téléphone sur le même Wi-Fi).
    host: true,
    proxy: { '/api': 'http://localhost:3001' },
  },
})
