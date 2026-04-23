import { ref } from 'vue'
import { encounterApi } from '@/domains/encounter/api/encounterApi'
import type { ConsultationResponse } from '../types/consultation.types'

export function useFeeDiscount(
  getConsultation: () => ConsultationResponse | null,
  updateStore: (updated: Partial<ConsultationResponse>) => void,
) {
  const feeDiscountType = ref<'percentage' | 'fixed'>('percentage')
  const feeDiscountValue = ref('')
  const isSavingDiscount = ref(false)
  const showFeeDiscountModal = ref(false)

  function openFeeDiscountModal() {
    const payment = getConsultation()?.payment
    feeDiscountType.value = (payment?.fee_discount_type as 'percentage' | 'fixed') ?? 'percentage'
    feeDiscountValue.value = payment?.fee_discount_value ? String(payment.fee_discount_value) : ''
    showFeeDiscountModal.value = true
  }

  async function saveFeeDiscount() {
    const consultation = getConsultation()
    if (!consultation) return
    isSavingDiscount.value = true
    try {
      const val = parseFloat(feeDiscountValue.value) || 0
      await encounterApi.saveFeeDiscount(consultation.id, {
        fee_discount_type: val > 0 ? feeDiscountType.value : null,
        fee_discount_value: val > 0 ? val : null,
      })
      updateStore({
        payment: {
          ...consultation.payment,
          fee_discount_type: val > 0 ? feeDiscountType.value : null,
          fee_discount_value: val > 0 ? val : null,
        },
      })
      showFeeDiscountModal.value = false
    } catch {
      // silent
    } finally {
      isSavingDiscount.value = false
    }
  }

  return {
    feeDiscountType,
    feeDiscountValue,
    isSavingDiscount,
    showFeeDiscountModal,
    openFeeDiscountModal,
    saveFeeDiscount,
  }
}
