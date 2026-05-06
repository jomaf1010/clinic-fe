import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { id: 'lab-1' } }),
    patch: vi.fn().mockResolvedValue({ data: { id: 'lab-1' } }),
    delete: vi.fn().mockResolvedValue({ data: { id: 'lab-1' } }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./labServiceApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('labServiceApi', () => {
  it('builds list query params with pagination and search', async () => {
    const http = makeHttp()
    const { labServiceApi } = await loadApi(http)

    await labServiceApi.list(4, 30, 'cbc platelet')

    expect(http.get).toHaveBeenCalledWith('/lab-services?page=4&per_page=30&q=cbc+platelet')
  })

  it('delegates create, update, deactivate, and find-or-create requests', async () => {
    const http = makeHttp()
    const { labServiceApi } = await loadApi(http)

    await labServiceApi.create({ name: 'CBC', category: 'Hematology', price: 500 })
    await labServiceApi.update('lab-1', { price: 550 })
    await labServiceApi.deactivate('lab-1')
    await labServiceApi.findOrCreate({ name: 'Urinalysis', category: 'Chemistry' })

    expect(http.post).toHaveBeenNthCalledWith(1, '/lab-services', { name: 'CBC', category: 'Hematology', price: 500 })
    expect(http.patch).toHaveBeenCalledWith('/lab-services/lab-1', { price: 550 })
    expect(http.delete).toHaveBeenCalledWith('/lab-services/lab-1')
    expect(http.post).toHaveBeenNthCalledWith(2, '/lab-services/find-or-create', { name: 'Urinalysis', category: 'Chemistry' })
  })

  it('encodes system lab item search terms', async () => {
    const http = makeHttp()
    const { labServiceApi } = await loadApi(http)

    await labServiceApi.searchSystem('blood sugar')

    expect(http.get).toHaveBeenCalledWith('/system/lab-items?q=blood%20sugar')
  })
})
