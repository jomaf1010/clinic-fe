import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ token: 'connection-token' }),
    post: vi.fn().mockResolvedValue({ token: 'subscription-token' }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./centrifugoApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('centrifugoApi', () => {
  it('loads a connection token', async () => {
    const http = makeHttp()
    const { centrifugoApi } = await loadApi(http)

    await centrifugoApi.getConnectionToken()

    expect(http.get).toHaveBeenCalledWith('/centrifugo/connection-token')
  })

  it('loads a subscription token for a channel', async () => {
    const http = makeHttp()
    const { centrifugoApi } = await loadApi(http)

    await centrifugoApi.getSubscriptionToken('queue:clinic-1')

    expect(http.post).toHaveBeenCalledWith('/centrifugo/subscription-token', { channel: 'queue:clinic-1' })
  })
})
