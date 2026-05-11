import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { uuid: 'encounter-1' } }),
    patch: vi.fn().mockResolvedValue({ data: { uuid: 'encounter-1' } }),
    put: vi.fn().mockResolvedValue({ data: { uuid: 'encounter-1' } }),
    delete: vi.fn().mockResolvedValue(undefined),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./encounterApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('encounterApi', () => {
  it('creates encounters for a patient', async () => {
    const http = makeHttp()
    const { encounterApi } = await loadApi(http)
    const payload = { type: 'consultation', chief_complaint: 'Fever' }

    await encounterApi.create('patient-1', payload)

    expect(http.post).toHaveBeenCalledWith('/patients/patient-1/encounters', payload)
  })

  it('builds encounter list requests with pagination and filters', async () => {
    const http = makeHttp()
    const { encounterApi } = await loadApi(http)

    await encounterApi.list('patient-1')
    await encounterApi.list('patient-1', 2, 25, { month: 5, year: 2026, pregnancy_id: 'pregnancy-1' })

    expect(http.get).toHaveBeenNthCalledWith(1, '/patients/patient-1/encounters?page=1&per_page=10')
    expect(http.get).toHaveBeenNthCalledWith(
      2,
      '/patients/patient-1/encounters?page=2&per_page=25&month=5&year=2026&pregnancy_id=pregnancy-1',
    )
  })

  it('loads and updates encounter details', async () => {
    const http = makeHttp()
    const { encounterApi } = await loadApi(http)
    const payload = { assessment: 'Viral syndrome', plan: 'Hydration and rest' }

    await encounterApi.get('encounter-1')
    await encounterApi.update('encounter-1', payload)

    expect(http.get).toHaveBeenCalledWith('/encounters/encounter-1')
    expect(http.patch).toHaveBeenCalledWith('/encounters/encounter-1', payload)
  })

  it('sends optimistic-lock header when updating with an expected timestamp', async () => {
    const http = makeHttp()
    const { encounterApi } = await loadApi(http)
    const payload = { assessment: { chief_complaint: 'Headache' } }

    await encounterApi.update('encounter-1', payload, '2026-04-30T00:00:00Z')

    expect(http.patch).toHaveBeenCalledWith(
      '/encounters/encounter-1',
      payload,
      { 'X-Expected-Updated-At': '2026-04-30T00:00:00Z' },
    )
  })

  it('delegates encounter lifecycle actions', async () => {
    const http = makeHttp()
    const { encounterApi } = await loadApi(http)

    await encounterApi.finalize('encounter-1')
    await encounterApi.generateSoapDraft('encounter-1')
    await encounterApi.delete('encounter-1')

    expect(http.post).toHaveBeenNthCalledWith(1, '/encounters/encounter-1/finalize')
    expect(http.post).toHaveBeenNthCalledWith(2, '/encounters/encounter-1/soap-draft')
    expect(http.delete).toHaveBeenCalledWith('/encounters/encounter-1')
  })

  it('saves consumables and fee discounts with wrapped payloads', async () => {
    const http = makeHttp()
    const { encounterApi } = await loadApi(http)
    const consumables = [{ consumable_id: 'syringe-1', quantity: 2 }]
    const discount = { fee_discount_type: 'amount', fee_discount_value: 150 }

    await encounterApi.saveConsumables('encounter-1', consumables)
    await encounterApi.saveFeeDiscount('encounter-1', discount)

    expect(http.put).toHaveBeenNthCalledWith(1, '/encounters/encounter-1/consumables', { consumables })
    expect(http.put).toHaveBeenNthCalledWith(2, '/encounters/encounter-1/fee-discount', discount)
  })

  it('requests med certs and encodes diagnosis search terms', async () => {
    const http = makeHttp()
    const { encounterApi } = await loadApi(http)

    await encounterApi.requestMedCert('encounter-1')
    await encounterApi.searchDiagnoses('acute fever + cough')

    expect(http.post).toHaveBeenCalledWith('/encounters/encounter-1/request-medcert')
    expect(http.get).toHaveBeenCalledWith('/diagnoses/search?q=acute%20fever%20%2B%20cough')
  })
})
