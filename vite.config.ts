import path from 'node:path'
import { execSync } from 'node:child_process'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

let commitHash = 'dev'
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim()
} catch {
  // git not available in container
}

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          mode: 'module',
        },
      },
    }),
    tailwindcss(),
    VitePWA({
      // `prompt` forces an explicit user confirmation before activating a new
      // service worker — important for a clinical app where silent reloads
      // mid-consultation would be awful. Update UX lives in usePwaUpdate.ts.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'MediFlow',
        short_name: 'MediFlow',
        description: 'Clinic management for Filipino doctors',
        theme_color: '#002954',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Don't precache the API — runtime caching handles it.
        navigateFallbackDenylist: [/^\/api\//],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Read-only catalogs — ICD-10 search, system medicines, specialty config.
            // Stable, cacheable, fine to serve stale while revalidating.
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/icd10') ||
              url.pathname.startsWith('/api/system-medicines') ||
              url.pathname.startsWith('/api/specialties'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'mediflow-catalogs',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // GET requests for clinic data. Network-first so users see fresh
            // data when online; cache is the offline fallback. Phase 2's
            // SyncEngine will own richer per-repository caching.
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith('/api/') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'mediflow-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Keep the virtual:pwa-register module resolvable during dev so
        // static imports compile everywhere. The `PROD` guard in
        // registerPwa() keeps us from ever actually activating a
        // service worker against the HMR server — no cached stale code.
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  build: {
    sourcemap: false,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['clinic.test'],
    proxy: {
      '/api': {
        target: 'http://clinic.test',
        changeOrigin: true,
      },
    },
  },
})
