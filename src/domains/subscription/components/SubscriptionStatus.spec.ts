import { describe, expect, it, vi } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import SubscriptionStatus from './SubscriptionStatus.vue'
import { useSubscriptionStore } from '../stores/subscriptionStore'
import type { SubscriptionStatus as StatusType } from '../types/subscription.types'

const STUBS = {
  Badge: { template: '<span><slot /></span>' },
  Button: {
    emits: ['click'],
    template: '<button type="button" :disabled="disabled" @click="$emit(`click`, $event)"><slot /></button>',
    props: ['disabled'],
  },
  Card: { template: '<section><slot /></section>' },
  CardContent: { template: '<div><slot /></div>' },
  CardHeader: { template: '<header><slot /></header>' },
  CardTitle: { template: '<h2><slot /></h2>' },
  CancelSubscriptionDialog: { template: '<button type="button">Cancel Subscription</button>' },
}

function makeStatus(overrides: Partial<StatusType> = {}): StatusType {
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

function mountStatus(status = makeStatus()) {
  return mountWithDeps(SubscriptionStatus, {
    props: { status },
    global: { stubs: STUBS },
  })
}

describe('SubscriptionStatus', () => {
  it('renders trial copy with singular day grammar', () => {
    const wrapper = mountStatus(makeStatus({
      is_trial: true,
      trial_days_left: 1,
      billing_period_ends_at: null,
    }))

    expect(wrapper.text()).toContain('Pro Trial')
    expect(wrapper.text()).toContain('Trial ends in 1 day')
  })

  it('renders trial copy with plural day grammar', () => {
    const wrapper = mountStatus(makeStatus({
      is_trial: true,
      trial_days_left: 3,
      billing_period_ends_at: null,
    }))

    expect(wrapper.text()).toContain('Trial ends in 3 days')
  })

  it('renders free plan without billing or subscription actions', () => {
    const wrapper = mountStatus(makeStatus({
      plan: 'free',
      billing_period_ends_at: null,
      next_billing_amount: 0,
    }))

    expect(wrapper.text()).toContain('Free')
    expect(wrapper.text()).not.toContain('Next billing')
    expect(wrapper.text()).not.toContain('Cancel Subscription')
    expect(wrapper.text()).not.toContain('Reactivate')
  })

  it('renders grace-period warning', () => {
    const wrapper = mountStatus(makeStatus({ is_in_grace_period: true }))

    expect(wrapper.text()).toContain('Billing overdue')
  })

  it('renders next billing details and cancel action for active Pro plans', () => {
    const wrapper = mountStatus()

    expect(wrapper.text()).toContain('Next billing:')
    expect(wrapper.text()).toContain('June 1, 2026')
    expect(wrapper.text()).toContain('PHP 1,299')
    expect(wrapper.text()).toContain('Cancel Subscription')
  })

  it('renders scheduled cancellation copy and calls reactivate', async () => {
    const wrapper = mountStatus(makeStatus({ cancel_at_period_end: true }))
    const store = useSubscriptionStore()
    store.reactivateSubscription = vi.fn().mockResolvedValue('reactivated')

    await wrapper.findAll('button').find((button) => button.text().includes('Reactivate'))?.trigger('click')

    expect(wrapper.text()).toContain('Pro access until')
    expect(wrapper.text()).toContain('cancellation scheduled')
    expect(store.reactivateSubscription).toHaveBeenCalledOnce()
  })
})
