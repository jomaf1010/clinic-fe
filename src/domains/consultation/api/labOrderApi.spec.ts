import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  upload: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { id: 'lab-order-1' } }),
    patch: vi.fn().mockResolvedValue({ data: { id: 'lab-order-1' } }),
    delete: vi.fn().mockResolvedValue({ data: { id: 'lab-order-1' } }),
    upload: vi.fn().mockResolvedValue({ data: { id: 'lab-order-1' } }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./labOrderApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('labOrderApi', () => {
  it('loads and creates encounter lab orders', async () => {
    const http = makeHttp()
    const { labOrderApi } = await loadApi(http)
    const items = [{ description: 'CBC', instruction: 'Fasting not required' }]

    await labOrderApi.getForEncounter('encounter-1')
    await labOrderApi.create('encounter-1', items)

    expect(http.get).toHaveBeenCalledWith('/encounters/encounter-1/lab-order')
    expect(http.post).toHaveBeenCalledWith('/encounters/encounter-1/lab-order', { items })
  })

  it('delegates lab order item mutations', async () => {
    const http = makeHttp()
    const { labOrderApi } = await loadApi(http)
    const createPayload = { description: 'Urinalysis', instruction: 'Morning sample' }
    const updatePayload = { instruction: 'Repeat if contaminated' }

    await labOrderApi.addItem('lab-order-1', createPayload)
    await labOrderApi.updateItem('lab-order-1', 'item-1', updatePayload)
    await labOrderApi.removeItem('lab-order-1', 'item-1')

    expect(http.post).toHaveBeenCalledWith('/lab-orders/lab-order-1/items', createPayload)
    expect(http.patch).toHaveBeenCalledWith('/lab-orders/lab-order-1/items/item-1', updatePayload)
    expect(http.delete).toHaveBeenCalledWith('/lab-orders/lab-order-1/items/item-1')
  })

  it('uploads lab result files as form data', async () => {
    const http = makeHttp()
    const { labOrderApi } = await loadApi(http)
    const file = new File(['result'], 'result.pdf', { type: 'application/pdf' })

    await labOrderApi.uploadResult('lab-order-1', 'item-1', file)

    expect(http.upload).toHaveBeenCalledWith('/lab-orders/lab-order-1/items/item-1/result', expect.any(FormData))
    const formData = http.upload.mock.calls[0][1] as FormData
    expect(formData.get('file')).toBe(file)
  })

  it('encodes system lab item search terms', async () => {
    const http = makeHttp()
    const { labOrderApi } = await loadApi(http)

    await labOrderApi.searchSystemItems('blood sugar + fasting')

    expect(http.get).toHaveBeenCalledWith('/system/lab-items?q=blood%20sugar%20%2B%20fasting')
  })
})
