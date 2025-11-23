import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ResIQ by Hostizzy',
        short_name: 'ResIQ',
        description: 'Property Management System for Vacation Rentals',
        theme_color: '#1e5a8e',
        icons: [
          {
            src: '/assets/logo-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/assets/logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    include: ['@supabase/supabase-js'],
    entries: [
      'index.html',
      'guest-portal.html',
      'offline.html'
    ]
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: '/index.html',
        guest: '/guest-portal.html',
        offline: '/offline.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
})
