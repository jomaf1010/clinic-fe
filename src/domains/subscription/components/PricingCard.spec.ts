import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import PricingCard from './PricingCard.vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { createPinia, setActivePinia } from 'pinia'

const STUBS = {
  Button: {
    props: ['disabled'],
    emits: ['click'],
    template: '<button type="button" :disabled="disabled" @click="$emit(`click`, $event)"><slot /></button>',
  },
  Card: { template: '<section><slot /></section>' },
  CardContent: { template: '<div><slot /></div>' },
  CardDescription: { template: '<p><slot /></p>' },
  CardHeader: { template: '<header><slot /></header>' },
  CardTitle: { template: '<h2><slot /></h2>' },
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-07T00:00:00.000Z'))
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.useRealTimers()
})

function mountCard(options: { loading?: boolean; trialEndsAt?: string | null } = {}) {
  const authStore = useAuthStore()
  authStore.user = {
    current_clinic: {
      is_trial: options.trialEndsAt !== undefined,
      trial_ends_at: options.trialEndsAt ?? null,
    },
  } as any
  return mountWithDeps(PricingCard, {
    noPinia: true,
    props: { loading: options.loading },
    global: { stubs: STUBS },
  })
}

describe('PricingCard', () => {
  it('renders Pro price and feature list', () => {
    const wrapper = mountCard()

    expect(wrapper.text()).toContain('MediFlow Pro')
    expect(wrapper.text()).toContain('PHP 1,499')
    expect(wrapper.text()).toContain('Messages, appointments')
    expect(wrapper.text()).toContain('Up to 2 practising doctors')
  })

  it('renders Max price and feature list when variant=max', () => {
    const authStore = useAuthStore()
    authStore.user = { current_clinic: { is_trial: false, trial_ends_at: null } } as any
    const wrapper = mountWithDeps(PricingCard, {
      noPinia: true,
      props: { variant: 'max' },
      global: { stubs: STUBS },
    })

    expect(wrapper.text()).toContain('MediFlow Max')
    expect(wrapper.text()).toContain('PHP 4,999')
    expect(wrapper.text()).toContain('Up to 6 practising doctors')
    expect(wrapper.text()).toContain('Upgrade to Max')
  })

  it('emits upgrade when the upgrade button is clicked', async () => {
    const wrapper = mountCard()

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('upgrade')).toHaveLength(1)
    expect(wrapper.text()).toContain('Upgrade to Pro')
  })

  it('shows trial subscribe copy and plural day grammar', () => {
    const wrapper = mountCard({ trialEndsAt: '2026-05-10T00:00:00.000Z' })

    expect(wrapper.text()).toContain('Your trial ends in 3 days')
    expect(wrapper.text()).toContain('Subscribe Now')
  })

  it('disables the action while loading', () => {
    const wrapper = mountCard({ loading: true })

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})
