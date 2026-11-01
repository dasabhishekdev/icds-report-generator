/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        // Files opened directly (screenshots, robots.txt, sitemap.xml) must not be answered with the app shell.
        navigateFallbackDenylist: [/^\/api\//, /\.[a-z0-9]+$/i],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'ICDS Report Generator',
        short_name: 'ICDS Reports',
        description: 'Anganwadi attendance, ration calculation and monthly ICDS reports',
        theme_color: '#0f766e',
        background_color: '#f8fafc',
        display: 'standalone',
        id: '/',
        start_url: '/',
        scope: '/',
        // PNGs are needed by Android launchers and the Play Store; the SVG stays for browsers.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        shortcuts: [
          {
            name: 'Jan Andolan photo',
            short_name: 'Jan Andolan',
            url: '/#/jan-andolan',
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:4000', changeOrigin: false } },
  },
  test: {
    environment: 'node',
  },
});
