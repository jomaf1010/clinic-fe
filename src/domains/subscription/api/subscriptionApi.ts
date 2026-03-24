import { http } from '@/lib/http'
import type {
  CheckoutResponse,
  MessageResponse,
  PaymentHistoryResponse,
  SubscriptionStatusResponse,
} from '../types/subscription.types'

export const subscriptionApi = {
  createCheckout(): Promise<CheckoutResponse> {
    return http.post<CheckoutResponse>('/subscription/checkout', { plan: 'pro' })
  },

  getStatus(): Promise<SubscriptionStatusResponse> {
    return http.get<SubscriptionStatusResponse>('/subscription/status')
  },

  getHistory(page = 1, perPage = 10): Promise<PaymentHistoryResponse> {
    return http.get<PaymentHistoryResponse>(
      `/subscription/history?page=${page}&per_page=${perPage}`,
    )
  },

  cancel(): Promise<MessageResponse> {
    return http.post<MessageResponse>('/subscription/cancel')
  },

  reactivate(): Promise<MessageResponse> {
    return http.post<MessageResponse>('/subscription/reactivate')
  },
}
