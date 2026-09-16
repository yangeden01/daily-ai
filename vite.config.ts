import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const basePath = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base: basePath,
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon.svg', 'icon-maskable.svg', 'icon-192.png', 'icon-maskable-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      devOptions: {
        enabled: true,
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        navigateFallback: `${basePath}index.html`,
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
      },
      manifest: {
        id: basePath,
        name: 'EdenNote — 個人日誌與記事',
        short_name: 'EdenNote',
        description: '記錄、搜尋與整理每日事件與筆記的 EdenNote 手機記事本。',
        theme_color: '#4338ca',
        background_color: '#1e1b4b',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: basePath,
        scope: basePath,
        lang: 'zh-Hant',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: `${basePath}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${basePath}icon-maskable-192.png`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: `${basePath}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${basePath}icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: `${basePath}icon-maskable.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          { src: `${basePath}icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        shortcuts: [
          { name: 'Daily', short_name: 'Daily', description: '新增或查看每日生活記錄', url: `${basePath}daily?mode=daily`, icons: [{ src: `${basePath}icon-192.png`, sizes: '192x192' }] },
          { name: 'Notes', short_name: 'Notes', description: '查看待做事項與備忘筆記', url: `${basePath}daily?mode=notes`, icons: [{ src: `${basePath}icon-192.png`, sizes: '192x192' }] },
          { name: '紀念日', short_name: '紀念日', description: '查看重要紀念日與倒數', url: `${basePath}daily?mode=anniversary`, icons: [{ src: `${basePath}icon-192.png`, sizes: '192x192' }] },
        ],
      }
    })
  ]
})
