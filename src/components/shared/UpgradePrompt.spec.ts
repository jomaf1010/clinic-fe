/**
 * Tests for UpgradePrompt.
 *
 * Two variants live in the same component: an inline pane (used by FeatureGate)
 * and a Dialog. We assert the variant rendered is the one selected by the
 * `inline` prop, that trial banner copy is plan-state-driven, and that the
 * upgrade button navigates and emits the expected close signal.
 */

import { describe, expect, it, vi } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import { setupTestPinia } from '@/__tests__/helpers/createPinia'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import UpgradePrompt from './UpgradePrompt.vue'

const pushSpy = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy }),
}))

function mount(props: { inline?: boolean; open?: boolean; feature?: string } = {}, trial: { isOnTrial?: boolean; trialDaysLeft?: number } = {}) {
  setupTestPinia()
  const auth = useAuthStore()
  auth.user = {
    current_clinic: {
      is_trial: trial.isOnTrial ?? false,
      trial_ends_at: trial.trialDaysLeft === undefined
        ? null
        : new Date(Date.now() + trial.trialDaysLeft * 24 * 60 * 60 * 1000).toISOString(),
    },
  } as never

  const wrapper = mountWithDeps(UpgradePrompt, {
    props,
    noPinia: true,
    global: {
      stubs: {
        // Dialog renders into a teleport — stubbing keeps the DOM tractable
        // and avoids needing a body-level mount target.
        Dialog: { template: '<div data-stub="dialog"><slot /></div>' },
        DialogContent: { template: '<div data-stub="dialog-content"><slot /></div>' },
        DialogHeader: { template: '<div><slot /></div>' },
        DialogTitle: { template: '<div><slot /></div>' },
        DialogDescription: { template: '<div><slot /></div>' },
        Button: { template: '<button class="btn" v-bind="$attrs"><slot /></button>' },
      },
    },
  })
  return wrapper
}

describe('UpgradePrompt', () => {
  it('renders the inline variant when inline=true', () => {
    const wrapper = mount({ inline: true })
    expect(wrapper.text()).toContain('Pro Feature')
    expect(wrapper.text()).toContain('available on the Pro plan')
    expect(wrapper.find('[data-stub="dialog"]').exists()).toBe(false)
  })

  it('renders the dialog variant by default (inline=false)', () => {
    const wrapper = mount({ inline: false, open: true })
    expect(wrapper.find('[data-stub="dialog"]').exists()).toBe(true)
  })

  it('formats the feature name in the inline body when provided', () => {
    const wrapper = mount({ inline: true, feature: 'Audit logs' })
    expect(wrapper.text()).toContain('The Audit logs feature is available')
  })

  it('shows trial-ending text when on trial with days remaining', () => {
    const wrapper = mount({ inline: true }, { isOnTrial: true, trialDaysLeft: 3 })
    expect(wrapper.text()).toContain('Your Pro trial ends in 3 days')
  })

  it('uses the singular "day" form when exactly 1 day is left', () => {
    const wrapper = mount({ inline: true }, { isOnTrial: true, trialDaysLeft: 1 })
    expect(wrapper.text()).toContain('Your Pro trial ends in 1 day.')
    expect(wrapper.text()).not.toContain('1 days')
  })

  it('shows expired copy when trial days reach 0', () => {
    const wrapper = mount({ inline: true }, { isOnTrial: true, trialDaysLeft: 0 })
    expect(wrapper.text()).toContain('Your Pro trial has expired')
  })

  it('clicking Upgrade in inline mode navigates to subscription', async () => {
    pushSpy.mockClear()
    const wrapper = mount({ inline: true })
    const upgradeBtn = wrapper.findAll('.btn').find((b) => b.text().includes('Upgrade to Pro'))
    expect(upgradeBtn).toBeDefined()
    await upgradeBtn!.trigger('click')
    expect(pushSpy).toHaveBeenCalledOnce()
    expect(pushSpy.mock.calls[0]?.[0]).toMatchObject({ name: expect.any(String) })
  })

  it('clicking Maybe Later in dialog mode closes the prompt', async () => {
    const wrapper = mount({ open: true })
    const closeBtn = wrapper.findAll('.btn').find((b) => b.text().includes('Maybe Later'))
    expect(closeBtn).toBeDefined()

    await closeBtn!.trigger('click')

    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('clicking Upgrade in dialog mode closes and navigates', async () => {
    pushSpy.mockClear()
    const wrapper = mount({ open: true })
    const upgradeBtn = wrapper.findAll('.btn').find((b) => b.text().trim() === 'Upgrade')
    expect(upgradeBtn).toBeDefined()

    await upgradeBtn!.trigger('click')

    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(pushSpy).toHaveBeenCalledOnce()
    expect(pushSpy.mock.calls[0]?.[0]).toMatchObject({ name: expect.any(String) })
  })
})
