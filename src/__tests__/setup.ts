/**
 * Global Vitest setup. Loaded by `vitest.config.ts -> setupFiles`.
 *
 * Responsibilities:
 *   - Fresh Pinia for every test (avoids state bleed between tests).
 *   - Stub `navigator.onLine` so connectivity-aware composables don't see
 *     happy-dom's defaults (which can flip mid-test).
 *   - Restore all mocks + clear module-mock cache after each test.
 *
 * Tests can opt out by using `setActivePinia` themselves before any
 * store import — but the default keeps the fast path simple.
 */

import { afterEach, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('navigator', { ...navigator, onLine: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})
