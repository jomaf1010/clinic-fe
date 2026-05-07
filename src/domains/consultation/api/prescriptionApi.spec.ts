import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: { id: 'prescription-1' } }),
    post: vi.fn().mockResolvedValue({ data: { id: 'prescription-1' } }),
    patch: vi.fn().mockResolvedValue({ data: { id: 'prescription-1' } }),
    delete: vi.fn().mockResolvedValue({ data: { id: 'prescription-1' } }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./prescriptionApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('prescriptionApi', () => {
  it('loads and creates encounter prescriptions', async () => {
    const http = makeHttp()
    const { prescriptionApi } = await loadApi(http)
    const items = [{ drug_name: 'Paracetamol', dose: '500mg', frequency: 'TID', duration: '3 days' }]

    await prescriptionApi.getForEncounter('encounter-1')
    await prescriptionApi.create('encounter-1', items)

    expect(http.get).toHaveBeenCalledWith('/encounters/encounter-1/prescription')
    expect(http.post).toHaveBeenCalledWith('/encounters/encounter-1/prescription', { items })
  })

  it('delegates prescription item mutations', async () => {
    const http = makeHttp()
    const { prescriptionApi } = await loadApi(http)
    const createPayload = { drug_name: 'Amoxicillin', dose: '500mg', frequency: 'TID', quantity: 21 }
    const updatePayload = { instructions: 'Take after meals', quantity: 18 }

    await prescriptionApi.addItem('prescription-1', createPayload)
    await prescriptionApi.updateItem('prescription-1', 'item-1', updatePayload)
    await prescriptionApi.removeItem('prescription-1', 'item-1')

    expect(http.post).toHaveBeenCalledWith('/prescriptions/prescription-1/items', createPayload)
    expect(http.patch).toHaveBeenCalledWith('/prescriptions/prescription-1/items/item-1', updatePayload)
    expect(http.delete).toHaveBeenCalledWith('/prescriptions/prescription-1/items/item-1')
  })
})
