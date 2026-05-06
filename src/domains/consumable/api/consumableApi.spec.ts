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
    post: vi.fn().mockResolvedValue({ data: { id: 'consumable-1' } }),
    patch: vi.fn().mockResolvedValue({ data: { id: 'consumable-1' } }),
    delete: vi.fn().mockResolvedValue({ data: { id: 'consumable-1' } }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./consumableApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('consumableApi', () => {
  it('builds list query params with pagination and search', async () => {
    const http = makeHttp()
    const { consumableApi } = await loadApi(http)

    await consumableApi.list(3, 25, 'gloves small')

    expect(http.get).toHaveBeenCalledWith('/consumables?page=3&per_page=25&q=gloves+small')
  })

  it('omits empty search query', async () => {
    const http = makeHttp()
    const { consumableApi } = await loadApi(http)

    await consumableApi.list(1, 20, '')

    expect(http.get).toHaveBeenCalledWith('/consumables?page=1&per_page=20')
  })

  it('delegates create, update, deactivate, and stock adjustment requests', async () => {
    const http = makeHttp()
    const { consumableApi } = await loadApi(http)

    await consumableApi.create({ name: 'Syringe', unit: 'piece', stock_quantity: 20 })
    await consumableApi.update('consumable-1', { name: 'Syringe 5ml' })
    await consumableApi.deactivate('consumable-1')
    await consumableApi.adjustStock('consumable-1', { delta: -2, reason: 'used' })

    expect(http.post).toHaveBeenNthCalledWith(1, '/consumables', { name: 'Syringe', unit: 'piece', stock_quantity: 20 })
    expect(http.patch).toHaveBeenCalledWith('/consumables/consumable-1', { name: 'Syringe 5ml' })
    expect(http.delete).toHaveBeenCalledWith('/consumables/consumable-1')
    expect(http.post).toHaveBeenNthCalledWith(2, '/consumables/consumable-1/adjust-stock', { delta: -2, reason: 'used' })
  })
})
