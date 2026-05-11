import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: { id: 'invoice-1' } }),
    patch: vi.fn().mockResolvedValue({ data: { id: 'invoice-1' } }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./billingApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('billingApi', () => {
  it('builds invoice list requests with optional filters', async () => {
    const http = makeHttp()
    const { billingApi } = await loadApi(http)

    await billingApi.list()
    await billingApi.list({ page: 2, per_page: 25, status: 'paid', search: 'Juan Dela Cruz' })

    expect(http.get).toHaveBeenNthCalledWith(1, '/invoices')
    expect(http.get).toHaveBeenNthCalledWith(2, '/invoices?page=2&per_page=25&status=paid&search=Juan+Dela+Cruz')
  })

  it('loads invoice detail, encounter invoice, summary, and pdf metadata', async () => {
    const http = makeHttp()
    const { billingApi } = await loadApi(http)

    await billingApi.get('invoice-1')
    await billingApi.forEncounter('encounter-1')
    await billingApi.summary()
    await billingApi.getPdf('invoice-1')

    expect(http.get).toHaveBeenNthCalledWith(1, '/invoices/invoice-1')
    expect(http.get).toHaveBeenNthCalledWith(2, '/encounters/encounter-1/invoice')
    expect(http.get).toHaveBeenNthCalledWith(3, '/billing/summary')
    expect(http.get).toHaveBeenNthCalledWith(4, '/invoices/invoice-1/pdf')
  })

  it('delegates invoice create and update requests', async () => {
    const http = makeHttp()
    const { billingApi } = await loadApi(http)
    const createPayload = { patient_id: 'patient-1', items: [] }
    const updatePayload = { notes: 'Updated after discount' }

    await billingApi.create(createPayload)
    await billingApi.update('invoice-1', updatePayload)

    expect(http.post).toHaveBeenCalledWith('/invoices', createPayload)
    expect(http.patch).toHaveBeenCalledWith('/invoices/invoice-1', updatePayload)
  })

  it('delegates invoice payment, void, med cert, and pdf generation requests', async () => {
    const http = makeHttp()
    const { billingApi } = await loadApi(http)
    const paymentPayload = { amount: 500, method: 'cash' }
    const voidPayload = { reason: 'wrong patient' }

    await billingApi.recordPayment('invoice-1', paymentPayload)
    await billingApi.void('invoice-1', voidPayload)
    await billingApi.requestMedCert('invoice-1')
    await billingApi.generatePdf('invoice-1')

    expect(http.post).toHaveBeenNthCalledWith(1, '/invoices/invoice-1/payments', paymentPayload)
    expect(http.patch).toHaveBeenCalledWith('/invoices/invoice-1/void', voidPayload)
    expect(http.post).toHaveBeenNthCalledWith(2, '/invoices/invoice-1/request-medcert')
    expect(http.post).toHaveBeenNthCalledWith(3, '/invoices/invoice-1/pdf')
  })
})
