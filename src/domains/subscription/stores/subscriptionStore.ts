import { defineStore } from 'pinia'
import { ref } from 'vue'
import { subscriptionApi } from '../api/subscriptionApi'
import type { CheckoutPlan, PaymentRecord, SubscriptionStatus } from '../types/subscription.types'

const TRUSTED_CHECKOUT_HOST = 'checkout.paymongo.com'

export function isTrustedCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === TRUSTED_CHECKOUT_HOST
  } catch {
    return false
  }
}

export const useSubscriptionStore = defineStore('subscription', () => {
  const status = ref<SubscriptionStatus | null>(null)
  const payments = ref<PaymentRecord[]>([])
  const totalPages = ref(1)
  const currentPage = ref(1)

  const loading = ref(false)
  const checkoutLoading = ref(false)
  const cancelLoading = ref(false)

  async function fetchStatus(): Promise<void> {
    loading.value = true
    try {
      const response = await subscriptionApi.getStatus()
      status.value = response.data
    } finally {
      loading.value = false
    }
  }

  async function fetchHistory(page = 1): Promise<void> {
    loading.value = true
    try {
      const response = await subscriptionApi.getHistory(page)
      payments.value = response.data
      totalPages.value = response.meta.last_page
      currentPage.value = response.meta.current_page
    } finally {
      loading.value = false
    }
  }

  async function initiateCheckout(plan: CheckoutPlan = 'pro'): Promise<void> {
    checkoutLoading.value = true
    try {
      const response = await subscriptionApi.createCheckout(plan)
      const checkoutUrl = response.data.checkout_url
      if (!isTrustedCheckoutUrl(checkoutUrl)) {
        throw new Error('Invalid checkout URL returned from server')
      }
      window.location.href = checkoutUrl
    } finally {
      checkoutLoading.value = false
    }
  }

  async function cancelSubscription(): Promise<string> {
    cancelLoading.value = true
    try {
      const response = await subscriptionApi.cancel()
      await fetchStatus()
      return response.message
    } finally {
      cancelLoading.value = false
    }
  }

  async function reactivateSubscription(): Promise<string> {
    cancelLoading.value = true
    try {
      const response = await subscriptionApi.reactivate()
      await fetchStatus()
      return response.message
    } finally {
      cancelLoading.value = false
    }
  }

  return {
    status,
    payments,
    totalPages,
    currentPage,
    loading,
    checkoutLoading,
    cancelLoading,
    fetchStatus,
    fetchHistory,
    initiateCheckout,
    cancelSubscription,
    reactivateSubscription,
  }
})
