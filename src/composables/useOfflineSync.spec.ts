/**
 * Tests for `useOfflineSync`.
 *
 * The composable bridges three things:
 *   1. SyncEngine events (action-succeeded / queue-drained / queue-stopped /
 *      action-discarded) → toast messages.
 *   2. `window.online` / `offline` events → flush trigger.
 *   3. Mount/unmount lifecycle → installs the listeners exactly once and
 *      removes them when the last consumer unmounts (refcount).
 *
 * SyncEngine is module-level state and the composable subscribes at
 * import-time, so each test resets modules and dynamic-imports BOTH the
 * mock-aware syncEngine and the composable.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

interface FakeSyncEngine {
  on: ReturnType<typeof vi.fn>
  flush: ReturnType<typeof vi.fn>
  pendingCount: ReturnType<typeof vi.fn>
  /** Internal: dispatch an event manually from the test. */
  __emit: (type: string, payload: unknown) => void
}

function makeSyncEngine(): FakeSyncEngine {
  const handlers = new Map<string, ((p: unknown) => void)[]>()
  return {
    on: vi.fn((type: string, cb: (p: unknown) => void) => {
      const list = handlers.get(type) ?? []
      list.push(cb)
      handlers.set(type, list)
      return () => {
        handlers.set(type, (handlers.get(type) ?? []).filter((h) => h !== cb))
      }
    }),
    flush: vi.fn().mockResolvedValue(undefined),
    pendingCount: vi.fn().mockResolvedValue(0),
    __emit: (type: string, payload: unknown) => {
      for (const cb of handlers.get(type) ?? []) cb(payload)
    },
  }
}

let syncEngine!: FakeSyncEngine
const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
}

beforeEach(() => {
  vi.resetModules()
  toastMock.success.mockReset()
  toastMock.error.mockReset()
  syncEngine = makeSyncEngine()
  vi.doMock('@/lib/sync/SyncEngine', () => ({ syncEngine }))
  vi.doMock('vue-sonner', () => ({ toast: toastMock }))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.doUnmock('@/lib/sync/SyncEngine')
  vi.doUnmock('vue-sonner')
})

async function loadComposable() {
  return await import('./useOfflineSync')
}

function mountUser(setup: () => unknown) {
  const Component = defineComponent({ setup, render: () => h('div') })
  return mount(Component)
}

describe('useOfflineSync — setup', () => {
  it('subscribes to all four SyncEngine events at import time', async () => {
    await loadComposable()
    const subscribed = syncEngine.on.mock.calls.map((args) => args[0])
    expect(subscribed).toEqual(
      expect.arrayContaining([
        'action-succeeded',
        'queue-drained',
        'queue-stopped',
        'action-discarded',
      ]),
    )
  })
})

describe('useOfflineSync — toast side-effects', () => {
  it('toasts success for queue-drained with processed > 0', async () => {
    await loadComposable()
    syncEngine.__emit('queue-drained', { processed: 3 })
    expect(toastMock.success).toHaveBeenCalledWith('Synced 3 offline changes')
  })

  it('does not toast when queue-drained reports 0 processed', async () => {
    await loadComposable()
    syncEngine.__emit('queue-drained', { processed: 0 })
    expect(toastMock.success).not.toHaveBeenCalled()
  })

  it('singular form for processed === 1', async () => {
    await loadComposable()
    syncEngine.__emit('queue-drained', { processed: 1 })
    expect(toastMock.success).toHaveBeenCalledWith('Synced 1 offline change')
  })

  it('queue-stopped due to "offline" suppresses the success toast', async () => {
    await loadComposable()
    syncEngine.__emit('queue-stopped', { reason: 'offline', processed: 2 })
    expect(toastMock.success).not.toHaveBeenCalled()
  })

  it('queue-stopped for backoff with processed > 0 still toasts', async () => {
    await loadComposable()
    syncEngine.__emit('queue-stopped', { reason: 'backoff', processed: 2 })
    expect(toastMock.success).toHaveBeenCalledWith('Synced 2 offline changes')
  })

  it('action-discarded triggers an error toast with the reason', async () => {
    await loadComposable()
    syncEngine.__emit('action-discarded', { reason: 'max retries exceeded' })
    expect(toastMock.error).toHaveBeenCalledWith(
      'An offline change was dropped',
      expect.objectContaining({ description: 'max retries exceeded' }),
    )
  })
})

describe('useOfflineSync — connectivity', () => {
  it('flushes the queue on mount when navigator.onLine', async () => {
    const { useOfflineSync } = await loadComposable()
    mountUser(() => {
      useOfflineSync()
      return {}
    })
    expect(syncEngine.flush).toHaveBeenCalled()
  })

  it('flushes the queue when the window goes online', async () => {
    const { useOfflineSync } = await loadComposable()
    mountUser(() => {
      useOfflineSync()
      return {}
    })
    syncEngine.flush.mockClear()

    window.dispatchEvent(new Event('online'))
    expect(syncEngine.flush).toHaveBeenCalled()
  })

  it('does NOT flush on the offline event', async () => {
    const { useOfflineSync } = await loadComposable()
    mountUser(() => {
      useOfflineSync()
      return {}
    })
    syncEngine.flush.mockClear()

    // Simulate offline by patching navigator.onLine and firing offline
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    window.dispatchEvent(new Event('offline'))
    expect(syncEngine.flush).not.toHaveBeenCalled()

    // restore
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })
})

describe('useOfflineSync — refcount', () => {
  it('only installs window listeners once across multiple consumers', async () => {
    const { useOfflineSync } = await loadComposable()
    const addSpy = vi.spyOn(window, 'addEventListener')

    const a = mountUser(() => {
      useOfflineSync()
      return {}
    })
    const b = mountUser(() => {
      useOfflineSync()
      return {}
    })

    const onlineCalls = addSpy.mock.calls.filter((c) => c[0] === 'online').length
    const offlineCalls = addSpy.mock.calls.filter((c) => c[0] === 'offline').length
    expect(onlineCalls).toBe(1)
    expect(offlineCalls).toBe(1)

    a.unmount()
    b.unmount()
  })
})
