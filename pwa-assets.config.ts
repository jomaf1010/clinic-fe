import {
  defineConfig,
  minimal2023Preset as preset,
} from '@vite-pwa/assets-generator/config'

/**
 * PWA icon generator config. Rebuilds PNG + maskable + favicon variants
 * from `public/favicon.svg` whenever `npm run generate-pwa-assets` is run.
 * The generated files (pwa-192x192.png, pwa-512x512.png, apple-touch-icon.png,
 * favicon.ico, maskable-icon-*.png) are emitted to `public/` — committed so
 * production builds don't depend on the generator being available at CI time.
 */
export default defineConfig({
  preset,
  images: ['public/favicon.svg'],
})
