import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const basePath = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: `${basePath}index.html`,
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
      },
      manifest: {
        name: 'Daily AI — Personal Event Journal',
        short_name: 'Daily AI',
        description: '記錄、搜尋與整理每日事件的本機優先個人日誌。',
        theme_color: '#4f46e5',
        background_color: '#f4f4f5',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: './',
        scope: './',
        lang: 'zh-Hant',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Daily', short_name: 'Daily', description: '新增或查看每日事件', url: 'daily', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'AI Search', short_name: 'AI Search', description: '開啟 AI Search', url: 'ai', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'Dashboard', short_name: 'Dashboard', description: '查看事件統計', url: 'dashboard', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
        ],
      }
    })
  ]
})
