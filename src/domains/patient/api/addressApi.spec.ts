import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./addressApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('addressApi', () => {
  it('builds lookup requests with required type only', async () => {
    const http = makeHttp()
    const { addressApi } = await loadApi(http)

    await addressApi.lookup('region')

    expect(http.get).toHaveBeenCalledWith('/address/lookup?type=region')
  })

  it('includes parent code when looking up child addresses', async () => {
    const http = makeHttp()
    const { addressApi } = await loadApi(http)

    await addressApi.lookup('city', 'PH-00 + NCR')

    expect(http.get).toHaveBeenCalledWith('/address/lookup?type=city&parent_code=PH-00+%2B+NCR')
  })
})
