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
  it('loads connection tokens', async () => {
    const http = makeHttp()
    const { centrifugoApi } = await loadApi(http)

    await centrifugoApi.getConnectionToken()

    expect(http.get).toHaveBeenCalledWith('/centrifugo/connection-token')
  })

  it('requests subscription tokens for a channel', async () => {
    const http = makeHttp()
    const { centrifugoApi } = await loadApi(http)

    await centrifugoApi.getSubscriptionToken('clinic:clinic-1')

    expect(http.post).toHaveBeenCalledWith('/centrifugo/subscription-token', { channel: 'clinic:clinic-1' })
  })
})
