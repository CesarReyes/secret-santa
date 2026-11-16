/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app from /<repo>/; override with BASE_PATH for other hosts.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@shared': path.resolve(import.meta.dirname, 'supabase/functions/_shared'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered from src/lib/pwa.ts
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Amigo Secreto',
        short_name: 'Amigo Secreto',
        description: 'El amigo secreto de la familia y los amigos',
        lang: 'es',
        theme_color: '#9f1023',
        background_color: '#fff8ee',
        display: 'standalone',
        orientation: 'portrait',
        id: base,
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
        globIgnores: ['og.png'], // only for link previews
        // A new version takes over right away (the plugin only sets these with injectRegister: 'auto').
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  // The entry chunk is mostly supabase-js + React; screens are split. The service worker caches it all.
  build: { chunkSizeWarningLimit: 600 },
  test: { environment: 'node' },
})
