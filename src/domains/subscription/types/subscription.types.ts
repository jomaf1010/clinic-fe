export interface CheckoutResponse {
  data: {
    checkout_url: string
    payment_id: string
  }
}

export interface SubscriptionStatus {
  plan: 'free' | 'pro'
  is_trial: boolean
  trial_ends_at: string | null
  trial_days_left: number | null
  billing_period_ends_at: string | null
  cancel_at_period_end: boolean
  is_in_grace_period: boolean
  next_billing_amount: number
  currency: string
}

export interface PaymentRecord {
  id: string
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'expired'
  payment_method: string | null
  plan: string
  type: 'upgrade' | 'renewal'
  billing_period_start: string
  billing_period_end: string
  paid_at: string | null
  created_at: string
}

export interface PaymentHistoryResponse {
  data: PaymentRecord[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export interface SubscriptionStatusResponse {
  data: SubscriptionStatus
}

export interface MessageResponse {
  message: string
}
