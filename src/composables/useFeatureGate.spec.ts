/**
 * Tests for `useFeatureGate`.
 *
 * Thin wrapper over `authStore.hasFeature(feature)`. The interesting bits
 * are the reactive `hasAccess` computed and the `guardAction` side effect
 * that flips `showUpgrade` instead of calling the callback when access is
 * denied. Each test mocks the auth store via `vi.doMock` and dynamic-imports
 * the composable so the mock is in place before the import runs.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

function mockAuth(featureCheck: (f: string) => boolean) {
  vi.doMock('@/domains/auth/stores/authStore', () => ({
    useAuthStore: () => ({
      hasFeature: featureCheck,
    }),
  }))
}

beforeEach(() => {
  vi.resetModules()
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.doUnmock('@/domains/auth/stores/authStore')
})

describe('useFeatureGate', () => {
  it('hasAccess reflects the auth store check', async () => {
    mockAuth((f) => f === 'lab_orders')
    const { useFeatureGate } = await import('./useFeatureGate')

    const { hasAccess } = useFeatureGate('lab_orders')
    expect(hasAccess.value).toBe(true)
  })

  it('hasAccess is false when the auth store denies', async () => {
    mockAuth(() => false)
    const { useFeatureGate } = await import('./useFeatureGate')

    const { hasAccess } = useFeatureGate('messages')
    expect(hasAccess.value).toBe(false)
  })

  it('guardAction runs the callback when allowed', async () => {
    mockAuth(() => true)
    const { useFeatureGate } = await import('./useFeatureGate')
    const { guardAction, showUpgrade } = useFeatureGate('messages')
    const cb = vi.fn()

    guardAction(cb)

    expect(cb).toHaveBeenCalledOnce()
    expect(showUpgrade.value).toBe(false)
  })

  it('guardAction sets showUpgrade and skips the callback when denied', async () => {
    mockAuth(() => false)
    const { useFeatureGate } = await import('./useFeatureGate')
    const { guardAction, showUpgrade } = useFeatureGate('messages')
    const cb = vi.fn()

    guardAction(cb)

    expect(cb).not.toHaveBeenCalled()
    expect(showUpgrade.value).toBe(true)
  })

  it('passes the feature name through to hasFeature', async () => {
    const spy = vi.fn(() => true)
    mockAuth(spy)
    const { useFeatureGate } = await import('./useFeatureGate')

    const { hasAccess } = useFeatureGate('audit_logs')
    // Touch the computed to force evaluation
    void hasAccess.value
    expect(spy).toHaveBeenCalledWith('audit_logs')
  })

  it('showUpgrade can be reset by the consumer', async () => {
    mockAuth(() => false)
    const { useFeatureGate } = await import('./useFeatureGate')
    const { guardAction, showUpgrade } = useFeatureGate('messages')

    guardAction(() => undefined)
    expect(showUpgrade.value).toBe(true)

    showUpgrade.value = false
    expect(showUpgrade.value).toBe(false)
  })
})
