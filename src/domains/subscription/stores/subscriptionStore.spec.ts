import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentRecord, SubscriptionStatus } from '../types/subscription.types'

interface MockSubscriptionApi {
  getStatus: ReturnType<typeof vi.fn>
  getHistory: ReturnType<typeof vi.fn>
  createCheckout: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  reactivate: ReturnType<typeof vi.fn>
}

function makeStatus(overrides: Partial<SubscriptionStatus> = {}): SubscriptionStatus {
  return {
    plan: 'pro',
    is_trial: false,
    trial_ends_at: null,
    trial_days_left: null,
    billing_period_ends_at: '2026-06-01T00:00:00.000Z',
    cancel_at_period_end: false,
    is_in_grace_period: false,
    next_billing_amount: 1299,
    currency: 'PHP',
    ...overrides,
  }
}

function makePayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: 'payment-1',
    amount: 1299,
    currency: 'PHP',
    status: 'paid',
    payment_method: 'card',
    plan: 'pro',
    type: 'renewal',
    billing_period_start: '2026-05-01T00:00:00.000Z',
    billing_period_end: '2026-06-01T00:00:00.000Z',
    paid_at: '2026-05-01T00:00:00.000Z',
    created_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeSubscriptionApi(overrides: Partial<MockSubscriptionApi> = {}): MockSubscriptionApi {
  return {
    getStatus: vi.fn().mockResolvedValue({ data: makeStatus() }),
    getHistory: vi.fn().mockResolvedValue({
      data: [makePayment()],
      meta: { current_page: 2, last_page: 4, per_page: 10, total: 31 },
    }),
    createCheckout: vi.fn().mockResolvedValue({
      data: { checkout_url: 'https://checkout.paymongo.com/session', payment_id: 'payment-1' },
    }),
    cancel: vi.fn().mockResolvedValue({ message: 'Subscription will cancel at period end.' }),
    reactivate: vi.fn().mockResolvedValue({ message: 'Subscription reactivated.' }),
    ...overrides,
  }
}

async function loadStore(subscriptionApi: MockSubscriptionApi) {
  vi.doMock('../api/subscriptionApi', () => ({ subscriptionApi }))
  return await import('./subscriptionStore')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('../api/subscriptionApi')
})

describe('subscriptionStore - fetching', () => {
  it('fetchStatus stores the current subscription status and clears loading', async () => {
    const subscriptionApi = makeSubscriptionApi({
      getStatus: vi.fn().mockResolvedValue({ data: makeStatus({ plan: 'free' }) }),
    })
    const { useSubscriptionStore } = await loadStore(subscriptionApi)
    const store = useSubscriptionStore()

    await store.fetchStatus()

    expect(subscriptionApi.getStatus).toHaveBeenCalledOnce()
    expect(store.status?.plan).toBe('free')
    expect(store.loading).toBe(false)
  })

  it('fetchHistory stores payments and pagination', async () => {
    const subscriptionApi = makeSubscriptionApi()
    const { useSubscriptionStore } = await loadStore(subscriptionApi)
    const store = useSubscriptionStore()

    await store.fetchHistory(2)

    expect(subscriptionApi.getHistory).toHaveBeenCalledWith(2)
    expect(store.payments[0]?.id).toBe('payment-1')
    expect(store.currentPage).toBe(2)
    expect(store.totalPages).toBe(4)
    expect(store.loading).toBe(false)
  })

  it('clears loading when fetchStatus fails', async () => {
    const subscriptionApi = makeSubscriptionApi({
      getStatus: vi.fn().mockRejectedValue(new Error('network down')),
    })
    const { useSubscriptionStore } = await loadStore(subscriptionApi)
    const store = useSubscriptionStore()

    await expect(store.fetchStatus()).rejects.toThrow('network down')

    expect(store.loading).toBe(false)
  })
})

describe('subscriptionStore - actions', () => {
  it('starts checkout only for HTTPS checkout URLs', async () => {
    const subscriptionApi = makeSubscriptionApi()
    const { useSubscriptionStore } = await loadStore(subscriptionApi)
    const store = useSubscriptionStore()

    await store.initiateCheckout()

    expect(subscriptionApi.createCheckout).toHaveBeenCalledOnce()
    expect(window.location.href).toBe('https://checkout.paymongo.com/session')
    expect(store.checkoutLoading).toBe(false)
  })

  it('rejects invalid checkout URLs and clears checkout loading', async () => {
    const subscriptionApi = makeSubscriptionApi({
      createCheckout: vi.fn().mockResolvedValue({
        data: { checkout_url: 'javascript:alert(1)', payment_id: 'payment-1' },
      }),
    })
    const { useSubscriptionStore } = await loadStore(subscriptionApi)
    const store = useSubscriptionStore()

    await expect(store.initiateCheckout()).rejects.toThrow('Invalid checkout URL')

    expect(store.checkoutLoading).toBe(false)
  })

  it('cancelSubscription refreshes status and returns the API message', async () => {
    const subscriptionApi = makeSubscriptionApi()
    const { useSubscriptionStore } = await loadStore(subscriptionApi)
    const store = useSubscriptionStore()

    const message = await store.cancelSubscription()

    expect(subscriptionApi.cancel).toHaveBeenCalledOnce()
    expect(subscriptionApi.getStatus).toHaveBeenCalledOnce()
    expect(message).toBe('Subscription will cancel at period end.')
    expect(store.cancelLoading).toBe(false)
  })

  it('reactivateSubscription refreshes status and returns the API message', async () => {
    const subscriptionApi = makeSubscriptionApi()
    const { useSubscriptionStore } = await loadStore(subscriptionApi)
    const store = useSubscriptionStore()

    const message = await store.reactivateSubscription()

    expect(subscriptionApi.reactivate).toHaveBeenCalledOnce()
    expect(subscriptionApi.getStatus).toHaveBeenCalledOnce()
    expect(message).toBe('Subscription reactivated.')
    expect(store.cancelLoading).toBe(false)
  })
})
