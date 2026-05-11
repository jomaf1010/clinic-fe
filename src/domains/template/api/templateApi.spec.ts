import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
    put: vi.fn().mockResolvedValue({ data: { id: 'template-1' } }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./templateApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('templateApi', () => {
  it('loads template lists and specific category variations', async () => {
    const http = makeHttp()
    const { templateApi } = await loadApi(http)

    await templateApi.list()
    await templateApi.show('prescription', 'default')

    expect(http.get).toHaveBeenNthCalledWith(1, '/clinic/templates')
    expect(http.get).toHaveBeenNthCalledWith(2, '/clinic/templates/prescription/default')
  })

  it('upserts a category variation with config payload', async () => {
    const http = makeHttp()
    const { templateApi } = await loadApi(http)
    const payload = { name: 'Compact Rx', config: { paperSize: 'a5' }, is_active: true }

    await templateApi.upsert('prescription', 'compact', payload)

    expect(http.put).toHaveBeenCalledWith('/clinic/templates/prescription/compact', payload)
  })
})
