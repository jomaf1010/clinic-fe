import path from 'node:path'
import { execSync } from 'node:child_process'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

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
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['clinic.test'],
  },
})
