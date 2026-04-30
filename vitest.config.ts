import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// Standalone Vitest config — intentionally NOT extending vite.config.ts so
// the PWA plugin (which spawns a service-worker build pipeline and pulls
// in workbox) doesn't run on every test invocation. We only need Vue +
// path aliases here.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Match the production `define` in vite.config.ts so any source code
    // that references this token type-checks under the test runner.
    __COMMIT_HASH__: JSON.stringify('test'),
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.{test,spec}.ts'],
    // Loaded for every test file — installs fresh Pinia, stubs
    // `navigator.onLine`, restores mocks afterEach. See setup.ts.
    setupFiles: ['src/__tests__/setup.ts'],
    // Speed: a single thread keeps module-mocked tests deterministic
    // (vi.doMock + dynamic imports don't always survive cross-thread
    // pool serialization in Vitest 3 yet).
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // Don't fail builds on tier-0 / infra files that exist mostly to
      // bootstrap testing or are environment-specific.
      exclude: [
        'src/__tests__/**',
        'src/main.ts',
        'src/router/**',
        'src/types/**',
        '**/*.d.ts',
        '**/*.spec.ts',
        '**/*.test.ts',
      ],
      // Thresholds apply only to files that have at least one test.
      // Tightening these as the suite stabilises is the way; starting
      // permissive avoids blocking the first PR on coverage gaps.
      thresholds: {
        lines: 70,
        branches: 70,
        functions: 70,
        statements: 70,
      },
    },
  },
})
