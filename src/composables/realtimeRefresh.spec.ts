import { describe, expect, it, vi } from 'vitest'
import { createDebouncedRefresh, shouldRunFallbackRefresh } from './realtimeRefresh'

describe('realtime refresh helpers', () => {
  it('coalesces rapid realtime events into one refresh', () => {
    vi.useFakeTimers()
    const refresh = vi.fn()
    const debouncedRefresh = createDebouncedRefresh(refresh, 500)

    debouncedRefresh()
    debouncedRefresh()
    debouncedRefresh()

    vi.advanceTimersByTime(499)
    expect(refresh).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(refresh).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('runs fallback polling only while realtime is disconnected', () => {
    expect(shouldRunFallbackRefresh(true)).toBe(false)
    expect(shouldRunFallbackRefresh(false)).toBe(true)
  })
})
