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
    post: vi.fn().mockResolvedValue({ data: { id: 'medicine-1' } }),
    patch: vi.fn().mockResolvedValue({ data: { id: 'medicine-1' } }),
    delete: vi.fn().mockResolvedValue({ data: { id: 'medicine-1' } }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./medicineApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('medicineApi', () => {
  it('builds list query params with pagination, search, and inactive flag', async () => {
    const http = makeHttp()
    const { medicineApi } = await loadApi(http)

    await medicineApi.list(2, 50, 'amox 500', true)

    expect(http.get).toHaveBeenCalledWith('/medicines?page=2&per_page=50&q=amox+500&include_inactive=1')
  })

  it('omits optional list params when they are not provided', async () => {
    const http = makeHttp()
    const { medicineApi } = await loadApi(http)

    await medicineApi.list()

    expect(http.get).toHaveBeenCalledWith('/medicines?page=1&per_page=20')
  })

  it('encodes medicine and system search terms', async () => {
    const http = makeHttp()
    const { medicineApi } = await loadApi(http)

    await medicineApi.search('vitamin c+zinc')
    await medicineApi.searchSystem('pain relief')

    expect(http.get).toHaveBeenNthCalledWith(1, '/medicines/search?q=vitamin%20c%2Bzinc')
    expect(http.get).toHaveBeenNthCalledWith(2, '/system/medicines?q=pain%20relief')
  })

  it('delegates create, update, deactivate, and stock adjustment requests', async () => {
    const http = makeHttp()
    const { medicineApi } = await loadApi(http)

    await medicineApi.create({ name: 'Paracetamol', unit: 'tablet', stock_quantity: 10 })
    await medicineApi.update('medicine-1', { name: 'Paracetamol 500mg' })
    await medicineApi.deactivate('medicine-1')
    await medicineApi.adjustStock('medicine-1', { delta: 5, reason: 'restock' })

    expect(http.post).toHaveBeenNthCalledWith(1, '/medicines', { name: 'Paracetamol', unit: 'tablet', stock_quantity: 10 })
    expect(http.patch).toHaveBeenCalledWith('/medicines/medicine-1', { name: 'Paracetamol 500mg' })
    expect(http.delete).toHaveBeenCalledWith('/medicines/medicine-1')
    expect(http.post).toHaveBeenNthCalledWith(2, '/medicines/medicine-1/adjust-stock', { delta: 5, reason: 'restock' })
  })
})
