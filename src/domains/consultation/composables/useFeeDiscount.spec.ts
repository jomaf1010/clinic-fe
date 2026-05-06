import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConsultationResponse } from '../types/consultation.types'

interface MockEncounterApi {
  saveFeeDiscount: ReturnType<typeof vi.fn>
}

function makeConsultation(overrides: Partial<ConsultationResponse> = {}): ConsultationResponse {
  return {
    id: 'encounter-1',
    payment: {
      fee_discount_type: null,
      fee_discount_value: null,
    },
    ...overrides,
  } as ConsultationResponse
}

function makeEncounterApi(overrides: Partial<MockEncounterApi> = {}): MockEncounterApi {
  return {
    saveFeeDiscount: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

async function loadComposable(encounterApi: MockEncounterApi) {
  vi.doMock('@/domains/encounter/api/encounterApi', () => ({ encounterApi }))
  return await import('./useFeeDiscount')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/domains/encounter/api/encounterApi')
})

describe('useFeeDiscount', () => {
  it('opens the modal with the current consultation discount', async () => {
    const encounterApi = makeEncounterApi()
    const consultation = makeConsultation({
      payment: {
        fee_discount_type: 'fixed',
        fee_discount_value: 150,
      },
    })
    const { useFeeDiscount } = await loadComposable(encounterApi)

    const discount = useFeeDiscount(() => consultation, vi.fn())
    discount.openFeeDiscountModal()

    expect(discount.feeDiscountType.value).toBe('fixed')
    expect(discount.feeDiscountValue.value).toBe('150')
    expect(discount.showFeeDiscountModal.value).toBe(true)
  })

  it('defaults to a percentage discount when no existing value is present', async () => {
    const encounterApi = makeEncounterApi()
    const { useFeeDiscount } = await loadComposable(encounterApi)

    const discount = useFeeDiscount(() => makeConsultation(), vi.fn())
    discount.feeDiscountType.value = 'fixed'
    discount.feeDiscountValue.value = '99'

    discount.openFeeDiscountModal()

    expect(discount.feeDiscountType.value).toBe('percentage')
    expect(discount.feeDiscountValue.value).toBe('')
  })

  it('saves a positive discount and updates local consultation payment state', async () => {
    const encounterApi = makeEncounterApi()
    const consultation = makeConsultation()
    const updateStore = vi.fn()
    const { useFeeDiscount } = await loadComposable(encounterApi)
    const discount = useFeeDiscount(() => consultation, updateStore)

    discount.showFeeDiscountModal.value = true
    discount.feeDiscountType.value = 'percentage'
    discount.feeDiscountValue.value = '20'
    await discount.saveFeeDiscount()

    expect(encounterApi.saveFeeDiscount).toHaveBeenCalledWith('encounter-1', {
      fee_discount_type: 'percentage',
      fee_discount_value: 20,
    })
    expect(updateStore).toHaveBeenCalledWith({
      payment: {
        fee_discount_type: 'percentage',
        fee_discount_value: 20,
      },
    })
    expect(discount.showFeeDiscountModal.value).toBe(false)
    expect(discount.isSavingDiscount.value).toBe(false)
  })

  it('clears the discount when the entered amount is zero or invalid', async () => {
    const encounterApi = makeEncounterApi()
    const consultation = makeConsultation({
      payment: {
        invoice_id: 'invoice-1',
        fee_discount_type: 'fixed',
        fee_discount_value: 100,
      },
    })
    const updateStore = vi.fn()
    const { useFeeDiscount } = await loadComposable(encounterApi)
    const discount = useFeeDiscount(() => consultation, updateStore)

    discount.feeDiscountType.value = 'fixed'
    discount.feeDiscountValue.value = 'not-a-number'
    await discount.saveFeeDiscount()

    expect(encounterApi.saveFeeDiscount).toHaveBeenCalledWith('encounter-1', {
      fee_discount_type: null,
      fee_discount_value: null,
    })
    expect(updateStore).toHaveBeenCalledWith({
      payment: {
        invoice_id: 'invoice-1',
        fee_discount_type: null,
        fee_discount_value: null,
      },
    })
  })

  it('does nothing when no consultation is loaded', async () => {
    const encounterApi = makeEncounterApi()
    const updateStore = vi.fn()
    const { useFeeDiscount } = await loadComposable(encounterApi)
    const discount = useFeeDiscount(() => null, updateStore)

    await discount.saveFeeDiscount()

    expect(encounterApi.saveFeeDiscount).not.toHaveBeenCalled()
    expect(updateStore).not.toHaveBeenCalled()
    expect(discount.isSavingDiscount.value).toBe(false)
  })

  it('keeps the modal open and clears saving state when the API rejects', async () => {
    const encounterApi = makeEncounterApi({
      saveFeeDiscount: vi.fn().mockRejectedValue(new Error('boom')),
    })
    const updateStore = vi.fn()
    const { useFeeDiscount } = await loadComposable(encounterApi)
    const discount = useFeeDiscount(() => makeConsultation(), updateStore)

    discount.showFeeDiscountModal.value = true
    discount.feeDiscountValue.value = '10'
    await discount.saveFeeDiscount()

    expect(updateStore).not.toHaveBeenCalled()
    expect(discount.showFeeDiscountModal.value).toBe(true)
    expect(discount.isSavingDiscount.value).toBe(false)
  })
})
