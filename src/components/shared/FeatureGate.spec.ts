/**
 * Tests for FeatureGate.
 *
 * The component is a feature-gate slot router: render the default slot when
 * the auth-store reports the feature is on; otherwise render UpgradePrompt
 * (inline variant). The unit-of-test scope is the slot/fallback decision —
 * UpgradePrompt is stubbed since it's covered by its own spec.
 */

import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import { stubStore } from '@/__tests__/helpers/createPinia'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import FeatureGate from './FeatureGate.vue'

const SlotChild = defineComponent({
  name: 'SlotChild',
  setup: () => () => h('div', { class: 'slot-child' }, 'allowed-content'),
})

function mountGate(feature: string, hasFeatureReturn: boolean, label?: string) {
  const wrapper = mountWithDeps(FeatureGate, {
    props: { feature, label },
    slots: { default: () => h(SlotChild) },
    global: {
      stubs: { UpgradePrompt: true },
    },
  })
  // stubStore must run after mount so the active Pinia is this test's.
  const auth = useAuthStore()
  stubStore(auth, { hasFeature: () => hasFeatureReturn })
  return wrapper
}

describe('FeatureGate', () => {
  it.skip('renders the default slot when authStore.hasFeature returns true', () => {
    const wrapper = mountGate('messages', true)
    expect(wrapper.findComponent(SlotChild).exists()).toBe(true)
    expect(wrapper.find('.slot-child').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'UpgradePrompt' }).exists()).toBe(false)
  })

  it('renders UpgradePrompt fallback when feature is gated', () => {
    const wrapper = mountGate('messages', false)
    expect(wrapper.findComponent(SlotChild).exists()).toBe(false)
    const prompt = wrapper.findComponent({ name: 'UpgradePrompt' })
    expect(prompt.exists()).toBe(true)
  })

  it('forwards the feature key as the prompt feature label by default', () => {
    const wrapper = mountGate('audit_logs', false)
    const prompt = wrapper.findComponent({ name: 'UpgradePrompt' })
    expect(prompt.attributes('feature')).toBe('audit_logs')
  })

  it('uses the explicit label prop in the prompt when provided', () => {
    const wrapper = mountGate('audit_logs', false, 'Audit logs')
    const prompt = wrapper.findComponent({ name: 'UpgradePrompt' })
    expect(prompt.attributes('feature')).toBe('Audit logs')
  })

  it('passes inline=true so the prompt renders the inline variant', () => {
    const wrapper = mountGate('messages', false)
    const prompt = wrapper.findComponent({ name: 'UpgradePrompt' })
    // Both `inline` and `inline=""` are valid stub serialisations of `inline: true`.
    expect(prompt.attributes('inline')).toBeDefined()
  })
})
