/**
 * Tests for the billing Pinia store.
 *
 * Coverage focus per Phase 3 plan:
 *   - Invoice fetch + pagination (page/total/last_page wiring).
 *   - Single-invoice fetch + per-encounter fetch fallback.
 *   - createInvoice / updateInvoice / recordPayment / voidInvoice — verify
 *     state mutation, list update, isSaving lifecycle.
 *   - Summary fetch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InvoiceListResponse, InvoiceResponse } from '../types/billing.types'

interface MockBillingApi {
  list: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  recordPayment: ReturnType<typeof vi.fn>
  void: ReturnType<typeof vi.fn>
  requestMedCert: ReturnType<typeof vi.fn>
  forEncounter: ReturnType<typeof vi.fn>
  summary: ReturnType<typeof vi.fn>
}

function makeInvoice(overrides: Partial<InvoiceResponse> = {}): InvoiceResponse {
  return {
    id: 'inv-1',
    clinic_id: 'c1',
    patient_id: 'p1',
    encounter_id: 'enc-1',
    patient_name: 'Patient One',
    created_by: 'u1',
    created_by_name: 'Dr Test',
    invoice_number: 'INV-0001',
    line_items: [],
    subtotal: 0,
    discount_type: null,
    discount_value: null,
    discount_amount: 0,
    total: 0,
    amount_paid: 0,
    balance: 0,
    payments: [],
    status: 'unpaid',
    notes: null,
    void_reason: null,
    voided_by: null,
    voided_by_name: null,
    voided_at: null,
    medcert_status: null,
    medcert_requested_by: null,
    medcert_requested_at: null,
    medcert_document_id: null,
    invoice_pdf_document: null,
    created_at: '2026-04-30T00:00:00Z',
    updated_at: '2026-04-30T00:00:00Z',
    ...overrides,
  }
}

function makeApi(overrides: Partial<MockBillingApi> = {}): MockBillingApi {
  return {
    list: vi.fn().mockResolvedValue({
      data: [],
      meta: { pagination: { page: 1, per_page: 10, total: 0, last_page: 1 } },
    } satisfies InvoiceListResponse),
    get: vi.fn().mockResolvedValue({ data: makeInvoice() }),
    create: vi.fn().mockResolvedValue({ data: makeInvoice() }),
    update: vi.fn().mockResolvedValue({ data: makeInvoice() }),
    recordPayment: vi.fn().mockResolvedValue({ data: makeInvoice() }),
    void: vi.fn().mockResolvedValue({ data: makeInvoice() }),
    requestMedCert: vi.fn().mockResolvedValue({ data: makeInvoice() }),
    forEncounter: vi.fn().mockResolvedValue({ data: makeInvoice() }),
    summary: vi.fn().mockResolvedValue({
      data: { total_revenue_this_month: 0, outstanding_balance: 0, invoices_today: 0, paid_today: 0 },
    }),
    ...overrides,
  }
}

async function loadStore(api: MockBillingApi) {
  vi.doMock('../api/billingApi', () => ({ billingApi: api }))
  vi.doMock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
  return await import('./billingStore')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('../api/billingApi')
  vi.doUnmock('vue-sonner')
})

describe('billingStore — fetchInvoices', () => {
  it('populates list, page, and totals from the meta block', async () => {
    const api = makeApi({
      list: vi.fn().mockResolvedValue({
        data: [makeInvoice({ id: 'inv-A' }), makeInvoice({ id: 'inv-B' })],
        meta: { pagination: { page: 2, per_page: 10, total: 25, last_page: 3 } },
      }),
    })
    const { useBillingStore } = await loadStore(api)
    const store = useBillingStore()

    await store.fetchInvoices({ page: 2, status: 'paid' })

    expect(api.list).toHaveBeenCalledWith({ page: 2, per_page: 10, status: 'paid', search: undefined })
    expect(store.invoices).toHaveLength(2)
    expect(store.currentPage).toBe(2)
    expect(store.lastPage).toBe(3)
    expect(store.totalInvoices).toBe(25)
    expect(store.isLoading).toBe(false)
  })

  it('defaults to page 1 with per_page=10 when no params passed', async () => {
    const api = makeApi()
    const { useBillingStore } = await loadStore(api)
    const store = useBillingStore()

    await store.fetchInvoices()

    expect(api.list).toHaveBeenCalledWith({ page: 1, per_page: 10, status: undefined, search: undefined })
  })

  it('clears isLoading even when the API rejects', async () => {
    const api = makeApi({
      list: vi.fn().mockRejectedValue(new Error('boom')),
    })
    const { useBillingStore } = await loadStore(api)
    const store = useBillingStore()

    await expect(store.fetchInvoices()).rejects.toThrow('boom')
    expect(store.isLoading).toBe(false)
  })
})

describe('billingStore — fetchInvoice / fetchForEncounter', () => {
  it('sets currentInvoice on success', async () => {
    const api = makeApi({
      get: vi.fn().mockResolvedValue({ data: makeInvoice({ id: 'inv-X' }) }),
    })
    const { useBillingStore } = await loadStore(api)
    const store = useBillingStore()

    await store.fetchInvoice('inv-X')
    expect(store.currentInvoice?.id).toBe('inv-X')
  })

  it('fetchForEncounter returns invoice on success', async () => {
    const api = makeApi({
      forEncounter: vi.fn().mockResolvedValue({ data: makeInvoice({ id: 'inv-E', encounter_id: 'enc-7' }) }),
    })
    const { useBillingStore } = await loadStore(api)
    const store = useBillingStore()

    const result = await store.fetchForEncounter('enc-7')
    expect(result?.id).toBe('inv-E')
    expect(store.currentInvoice?.id).toBe('inv-E')
  })

  it('fetchForEncounter returns null and clears currentInvoice when API rejects', async () => {
    const api = makeApi({
      forEncounter: vi.fn().mockRejectedValue(new Error('not found')),
    })
    const { useBillingStore } = await loadStore(api)
    const store = useBillingStore()

    const result = await store.fetchForEncounter('enc-missing')
    expect(result).toBeNull()
    expect(store.currentInvoice).toBeNull()
  })
})

describe('billingStore — createInvoice', () => {
  it('toggles isSaving and returns the created invoice', async () => {
    const api = makeApi({
      create: vi.fn().mockResolvedValue({ data: makeInvoice({ id: 'inv-NEW' }) }),
    })
    const { useBillingStore } = await loadStore(api)
    const store = useBillingStore()

    const result = await store.createInvoice({
      patient_id: 'p1',
      line_items: [{ type: 'consultation_fee', description: 'CF', quantity: 1, unit_price: 500 }],
    })

    expect(result.id).toBe('inv-NEW')
    expect(store.isSaving).toBe(false)
    expect(api.create).toHaveBeenCalled()
  })
})

describe('billingStore — updateInvoice / recordPayment / voidInvoice', () => {
  it('updateInvoice swaps the matching invoice in the list', async () => {
    const original = makeInvoice({ id: 'inv-1', total: 500 })
    const updated = makeInvoice({ id: 'inv-1', total: 1000 })
    const api = makeApi({
      update: vi.fn().mockResolvedValue({ data: updated }),
    })
    const { useBillingStore } = await loadStore(api)
    const store = useBillingStore()
    store.invoices = [original, makeInvoice({ id: 'inv-2' })]

    await store.updateInvoice('inv-1', [{ id: 'li-1', quantity: 2 }])

    expect(store.currentInvoice?.total).toBe(1000)
    expect(store.invoices[0]?.total).toBe(1000)
    expect(store.invoices[1]?.id).toBe('inv-2')
  })

  it('recordPayment updates currentInvoice and the list entry', async () => {
    const updated = makeInvoice({ id: 'inv-1', amount_paid: 300, balance: 200 })
    const api = makeApi({
      recordPayment: vi.fn().mockResolvedValue({ data: updated }),
    })
    const { useBillingStore } = await loadStore(api)
    const store = useBillingStore()
    store.invoices = [makeInvoice({ id: 'inv-1' })]

    await store.recordPayment('inv-1', { amount: 300, method: 'cash' })

    expect(store.currentInvoice?.amount_paid).toBe(300)
    expect(store.invoices[0]?.amount_paid).toBe(300)
  })

  it('voidInvoice marks the invoice voided in state', async () => {
    const voided = makeInvoice({ id: 'inv-1', status: 'void', void_reason: 'duplicate' })
    const api = makeApi({
      void: vi.fn().mockResolvedValue({ data: voided }),
    })
    const { useBillingStore } = await loadStore(api)
    const store = useBillingStore()
    store.invoices = [makeInvoice({ id: 'inv-1' })]

    await store.voidInvoice('inv-1', 'duplicate')

    expect(store.currentInvoice?.status).toBe('void')
    expect(store.invoices[0]?.status).toBe('void')
  })
})

describe('billingStore — fetchSummary + clearCurrent', () => {
  it('fetchSummary stores the data block', async () => {
    const api = makeApi({
      summary: vi.fn().mockResolvedValue({
        data: { total_revenue_this_month: 12000, outstanding_balance: 500, invoices_today: 3, paid_today: 2 },
      }),
    })
    const { useBillingStore } = await loadStore(api)
    const store = useBillingStore()

    await store.fetchSummary()
    expect(store.summary?.total_revenue_this_month).toBe(12000)
    expect(store.isLoadingSummary).toBe(false)
  })

  it('clearCurrent resets the current invoice', async () => {
    const api = makeApi()
    const { useBillingStore } = await loadStore(api)
    const store = useBillingStore()
    store.currentInvoice = makeInvoice()
    store.clearCurrent()
    expect(store.currentInvoice).toBeNull()
  })
})
