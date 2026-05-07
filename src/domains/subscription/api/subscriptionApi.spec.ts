import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ message: 'ok' }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./subscriptionApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('subscriptionApi', () => {
  it('creates pro checkout sessions', async () => {
    const http = makeHttp()
    const { subscriptionApi } = await loadApi(http)

    await subscriptionApi.createCheckout()

    expect(http.post).toHaveBeenCalledWith('/subscription/checkout', { plan: 'pro' })
  })

  it('loads subscription status and paginated payment history', async () => {
    const http = makeHttp()
    const { subscriptionApi } = await loadApi(http)

    await subscriptionApi.getStatus()
    await subscriptionApi.getHistory()
    await subscriptionApi.getHistory(3, 25)

    expect(http.get).toHaveBeenNthCalledWith(1, '/subscription/status')
    expect(http.get).toHaveBeenNthCalledWith(2, '/subscription/history?page=1&per_page=10')
    expect(http.get).toHaveBeenNthCalledWith(3, '/subscription/history?page=3&per_page=25')
  })

  it('delegates cancellation and reactivation requests', async () => {
    const http = makeHttp()
    const { subscriptionApi } = await loadApi(http)

    await subscriptionApi.cancel()
    await subscriptionApi.reactivate()

    expect(http.post).toHaveBeenNthCalledWith(1, '/subscription/cancel')
    expect(http.post).toHaveBeenNthCalledWith(2, '/subscription/reactivate')
  })
})
