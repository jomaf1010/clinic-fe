import { afterEach, describe, expect, it, vi } from 'vitest'
import { APP_CACHE_NAMES, clearAppCaches } from './appCaches'

const originalCaches = globalThis.caches

describe('clearAppCaches', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: originalCaches,
    })
  })

  it('deletes current and legacy app-owned runtime caches', async () => {
    const deleteCache = vi.fn().mockResolvedValue(true)
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: { delete: deleteCache },
    })

    await clearAppCaches()

    expect(APP_CACHE_NAMES).toContain('mediflow-catalogs')
    expect(APP_CACHE_NAMES).toContain('mediflow-api')
    expect(deleteCache).toHaveBeenCalledWith('mediflow-catalogs')
    expect(deleteCache).toHaveBeenCalledWith('mediflow-api')
  })

  it('does nothing when Cache Storage is unavailable', async () => {
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: undefined,
    })

    await expect(clearAppCaches()).resolves.toBeUndefined()
  })
})
