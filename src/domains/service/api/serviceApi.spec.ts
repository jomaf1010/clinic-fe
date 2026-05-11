import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { id: 'service-1' } }),
    patch: vi.fn().mockResolvedValue({ data: { id: 'service-1' } }),
    delete: vi.fn().mockResolvedValue({ data: { id: 'service-1' } }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./serviceApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('serviceApi', () => {
  it('builds list query params with pagination and filters', async () => {
    const http = makeHttp()
    const { serviceApi } = await loadApi(http)

    await serviceApi.list(2, 15, { q: 'cleaning', category: 'Dental', specialty: 'dentistry' })

    expect(http.get).toHaveBeenCalledWith('/clinic-services?page=2&per_page=15&q=cleaning&category=Dental&specialty=dentistry')
  })

  it('omits empty list filters', async () => {
    const http = makeHttp()
    const { serviceApi } = await loadApi(http)

    await serviceApi.list()

    expect(http.get).toHaveBeenCalledWith('/clinic-services?page=1&per_page=20')
  })

  it('delegates create, update, and deactivate requests', async () => {
    const http = makeHttp()
    const { serviceApi } = await loadApi(http)

    await serviceApi.create({ name: 'Cleaning', category: 'Dental', specialties: ['dentistry'], price: 1200 })
    await serviceApi.update('service-1', { price: 1500 })
    await serviceApi.deactivate('service-1')

    expect(http.post).toHaveBeenCalledWith('/clinic-services', { name: 'Cleaning', category: 'Dental', specialties: ['dentistry'], price: 1200 })
    expect(http.patch).toHaveBeenCalledWith('/clinic-services/service-1', { price: 1500 })
    expect(http.delete).toHaveBeenCalledWith('/clinic-services/service-1')
  })

  it('builds system service search params with optional specialty', async () => {
    const http = makeHttp()
    const { serviceApi } = await loadApi(http)

    await serviceApi.searchSystem('oral exam', 'dentistry')
    await serviceApi.searchSystem('follow up')

    expect(http.get).toHaveBeenNthCalledWith(1, '/system-services/search?q=oral+exam&specialty=dentistry')
    expect(http.get).toHaveBeenNthCalledWith(2, '/system-services/search?q=follow+up')
  })

  it('saves encounter procedures', async () => {
    const http = makeHttp()
    const { serviceApi } = await loadApi(http)
    const procedures = [{ service_id: 'service-1', name: 'Cleaning', quantity: 1, unit_price: 1200, notes: null }]

    await serviceApi.saveProcedures('encounter-1', procedures)

    expect(http.put).toHaveBeenCalledWith('/encounters/encounter-1/procedures', { procedures })
  })
})
