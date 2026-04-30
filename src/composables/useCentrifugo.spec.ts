/**
 * Tests for `useCentrifugo`.
 *
 * The composable wraps a real `Centrifuge` client. We don't want WebSockets
 * in unit tests, so we mock the `centrifuge` package entirely with a fake
 * Centrifuge constructor + Subscription class that record calls and let
 * the test fire `connected`/`publication`/etc. events.
 *
 * Module-level state (`client`, `subscriptions`) means each test starts
 * with `vi.resetModules()` and dynamic-imports the composable.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

interface FakeSubscription {
  on: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
  unsubscribe: ReturnType<typeof vi.fn>
  removeAllListeners: ReturnType<typeof vi.fn>
  __emit: (event: string, payload: unknown) => void
}

interface FakeClient {
  on: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  newSubscription: ReturnType<typeof vi.fn>
  getSubscription: ReturnType<typeof vi.fn>
  __emit: (event: string, payload: unknown) => void
  __subs: Map<string, FakeSubscription>
}

let lastClient: FakeClient | null = null

function makeSub(): FakeSubscription {
  const handlers = new Map<string, ((p: unknown) => void)[]>()
  return {
    on: vi.fn((event: string, cb: (p: unknown) => void) => {
      const list = handlers.get(event) ?? []
      list.push(cb)
      handlers.set(event, list)
    }),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    removeAllListeners: vi.fn(() => handlers.clear()),
    __emit(event, payload) {
      for (const cb of handlers.get(event) ?? []) cb(payload)
    },
  }
}

function makeClient(): FakeClient {
  const handlers = new Map<string, ((p: unknown) => void)[]>()
  const subs = new Map<string, FakeSubscription>()
  const client: FakeClient = {
    on: vi.fn((event: string, cb: (p: unknown) => void) => {
      const list = handlers.get(event) ?? []
      list.push(cb)
      handlers.set(event, list)
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    newSubscription: vi.fn((channel: string) => {
      const sub = makeSub()
      subs.set(channel, sub)
      return sub
    }),
    getSubscription: vi.fn((channel: string) => subs.get(channel)),
    __emit(event, payload) {
      for (const cb of handlers.get(event) ?? []) cb(payload)
    },
    __subs: subs,
  }
  return client
}

beforeEach(() => {
  vi.resetModules()
  lastClient = null

  vi.doMock('centrifuge', () => {
    return {
      Centrifuge: vi.fn(() => {
        const c = makeClient()
        lastClient = c
        return c
      }),
    }
  })
  vi.doMock('@/api/centrifugoApi', () => ({
    centrifugoApi: {
      getConnectionToken: vi.fn().mockResolvedValue({ token: 'conn-token' }),
      getSubscriptionToken: vi.fn().mockResolvedValue({ token: 'sub-token' }),
    },
  }))
  // The composable reads import.meta.env.VITE_CENTRIFUGO_URL — provide it.
  vi.stubEnv('VITE_CENTRIFUGO_URL', 'wss://test/centrifugo')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.doUnmock('centrifuge')
  vi.doUnmock('@/api/centrifugoApi')
})

describe('useCentrifugo — connect lifecycle', () => {
  it('creates a Centrifuge client and connects on first connect()', async () => {
    const { useCentrifugo } = await import('./useCentrifugo')
    const cf = useCentrifugo()
    cf.connect()

    expect(lastClient).not.toBeNull()
    expect(lastClient!.connect).toHaveBeenCalledOnce()
  })

  it('does not create a second client on a second connect() call', async () => {
    const { useCentrifugo } = await import('./useCentrifugo')
    const cf = useCentrifugo()
    cf.connect()
    cf.connect()

    expect(lastClient!.connect).toHaveBeenCalledOnce()
  })

  it('flips isConnected when the client emits "connected"', async () => {
    const { useCentrifugo } = await import('./useCentrifugo')
    const cf = useCentrifugo()
    cf.connect()
    expect(cf.isConnected.value).toBe(false)
    lastClient!.__emit('connected', {})
    expect(cf.isConnected.value).toBe(true)
  })

  it('flips isConnected back when the client emits "disconnected"', async () => {
    const { useCentrifugo } = await import('./useCentrifugo')
    const cf = useCentrifugo()
    cf.connect()
    lastClient!.__emit('connected', {})
    lastClient!.__emit('disconnected', { code: 1006, reason: 'fail' })
    expect(cf.isConnected.value).toBe(false)
  })
})

describe('useCentrifugo — subscribe / unsubscribe', () => {
  it('creates a new subscription on first subscribe', async () => {
    const { useCentrifugo } = await import('./useCentrifugo')
    const cf = useCentrifugo()
    cf.connect()

    const handler = vi.fn()
    cf.subscribe('clinic:1:patient:p1', handler)

    expect(lastClient!.newSubscription).toHaveBeenCalledWith(
      'clinic:1:patient:p1',
      expect.objectContaining({ getToken: expect.any(Function) }),
    )
    const sub = lastClient!.__subs.get('clinic:1:patient:p1')
    expect(sub?.subscribe).toHaveBeenCalledOnce()
  })

  it('reuses an existing subscription on the second subscribe', async () => {
    const { useCentrifugo } = await import('./useCentrifugo')
    const cf = useCentrifugo()
    cf.connect()

    const h1 = vi.fn()
    const h2 = vi.fn()
    cf.subscribe('chan-1', h1)
    cf.subscribe('chan-1', h2)

    // Only one subscription was created
    expect(lastClient!.newSubscription).toHaveBeenCalledTimes(1)
    // Both handlers were attached as publication listeners
    const sub = lastClient!.__subs.get('chan-1')
    const publicationCalls = sub!.on.mock.calls.filter((c) => c[0] === 'publication')
    expect(publicationCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('unsubscribe tears down listeners and removes the channel', async () => {
    const { useCentrifugo } = await import('./useCentrifugo')
    const cf = useCentrifugo()
    cf.connect()
    cf.subscribe('chan-1', vi.fn())
    const sub = lastClient!.__subs.get('chan-1')

    cf.unsubscribe('chan-1')

    expect(sub!.unsubscribe).toHaveBeenCalledOnce()
    expect(sub!.removeAllListeners).toHaveBeenCalledOnce()
    expect(cf.getSubscription('chan-1')).toBeUndefined()
  })

  it('subscribe is a no-op when not connected (no client yet)', async () => {
    const { useCentrifugo } = await import('./useCentrifugo')
    const cf = useCentrifugo()
    // Note: did NOT call connect()
    cf.subscribe('chan-1', vi.fn())

    expect(lastClient).toBeNull()
  })
})

describe('useCentrifugo — disconnect', () => {
  it('tears down all subscriptions and the client', async () => {
    const { useCentrifugo } = await import('./useCentrifugo')
    const cf = useCentrifugo()
    cf.connect()
    cf.subscribe('chan-1', vi.fn())
    cf.subscribe('chan-2', vi.fn())

    const sub1 = lastClient!.__subs.get('chan-1')
    const sub2 = lastClient!.__subs.get('chan-2')

    cf.disconnect()

    expect(sub1!.unsubscribe).toHaveBeenCalledOnce()
    expect(sub2!.unsubscribe).toHaveBeenCalledOnce()
    expect(lastClient!.disconnect).toHaveBeenCalledOnce()
    expect(cf.isConnected.value).toBe(false)
  })

  it('after disconnect, connect() can create a fresh client', async () => {
    const { useCentrifugo } = await import('./useCentrifugo')
    const cf = useCentrifugo()
    cf.connect()
    const first = lastClient
    cf.disconnect()

    cf.connect()
    // a new client was created (different instance reference)
    expect(lastClient).not.toBe(first)
  })
})

describe('useCentrifugo — publication delivery', () => {
  it('forwards inbound publications to the consumer handler', async () => {
    const { useCentrifugo } = await import('./useCentrifugo')
    const cf = useCentrifugo()
    cf.connect()

    const handler = vi.fn()
    cf.subscribe('chan-1', handler)

    const sub = lastClient!.__subs.get('chan-1')!
    sub.__emit('publication', { data: { type: 'encounter.updated' } })
    expect(handler).toHaveBeenCalledWith({ data: { type: 'encounter.updated' } })
  })
})
