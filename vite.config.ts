import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 專案站台在 /poker-app/ 子路徑；只在部署 CI 設 GITHUB_PAGES，
  // 本地 dev / preview / e2e 維持 '/'，避免 playwright 的 goto('/') 打到子路徑 404
  base: process.env.GITHUB_PAGES ? '/poker-app/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
      manifest: {
        name: '德州撲克練習',
        short_name: '撲克練習',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
})
