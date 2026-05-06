/**
 * Tests for TrialBanner.
 *
 * The banner only shows when:
 *   - the clinic is on trial
 *   - trialDaysLeft is between 1 and 7 inclusive
 *   - the user hasn't dismissed it locally
 *
 * Anything outside that band stays hidden, including the >0 guard
 * (otherwise an expired trial would still flash the "ends in 0 days" copy).
 */

import { describe, expect, it, vi } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import { setupTestPinia } from '@/__tests__/helpers/createPinia'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import TrialBanner from './TrialBanner.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function mountBanner(trial: { isOnTrial: boolean; trialDaysLeft: number }) {
  setupTestPinia()
  const auth = useAuthStore()
  auth.user = {
    current_clinic: {
      is_trial: trial.isOnTrial,
      trial_ends_at: trial.trialDaysLeft > 0
        ? new Date(Date.now() + trial.trialDaysLeft * 24 * 60 * 60 * 1000).toISOString()
        : null,
    },
  } as never

  const wrapper = mountWithDeps(TrialBanner, {
    noPinia: true,
    global: {
      stubs: {
        Button: { template: '<button class="btn" @click="$emit(`click`, $event)"><slot /></button>' },
      },
    },
  })
  return wrapper
}

describe('TrialBanner', () => {
  it('is hidden when the clinic is not on trial', () => {
    const wrapper = mountBanner({ isOnTrial: false, trialDaysLeft: 3 })
    expect(wrapper.text()).toBe('')
  })

  it('is hidden when more than 7 days are left', () => {
    const wrapper = mountBanner({ isOnTrial: true, trialDaysLeft: 10 })
    expect(wrapper.text()).toBe('')
  })

  it('is hidden when the trial has expired (0 days)', () => {
    const wrapper = mountBanner({ isOnTrial: true, trialDaysLeft: 0 })
    expect(wrapper.text()).toBe('')
  })

  it('shows in the 1-to-7 band with the plural day count', () => {
    const wrapper = mountBanner({ isOnTrial: true, trialDaysLeft: 5 })
    expect(wrapper.text()).toContain('Your Pro trial ends in 5 days.')
    expect(wrapper.text()).toContain('Upgrade now to keep all Pro features.')
  })

  it('uses the "tomorrow" copy when exactly 1 day is left', () => {
    const wrapper = mountBanner({ isOnTrial: true, trialDaysLeft: 1 })
    expect(wrapper.text()).toContain('Your Pro trial ends tomorrow.')
  })

  it('hides itself when the close button is clicked', async () => {
    const wrapper = mountBanner({ isOnTrial: true, trialDaysLeft: 3 })
    expect(wrapper.text()).toContain('Your Pro trial ends in 3 days.')
    // The close × is the second button (after Upgrade) — find by being the
    // last `<button>` in the banner DOM.
    const closeBtn = wrapper.findAll('button').at(-1)
    expect(closeBtn).toBeDefined()
    await closeBtn!.trigger('click')
    expect(wrapper.text()).toBe('')
  })
})
