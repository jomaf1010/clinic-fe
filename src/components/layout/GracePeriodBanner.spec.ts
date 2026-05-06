/**
 * Tests for GracePeriodBanner.
 *
 * Visibility is driven entirely by `authStore.isInGracePeriod` and a local
 * dismiss flag. We assert all three permutations and the dismiss flow.
 */

import { describe, expect, it, vi } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import { setupTestPinia } from '@/__tests__/helpers/createPinia'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import GracePeriodBanner from './GracePeriodBanner.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function mountBanner(isInGracePeriod: boolean) {
  setupTestPinia()
  const auth = useAuthStore()
  auth.user = {
    current_clinic: {
      is_in_grace_period: isInGracePeriod,
    },
  } as never

  const wrapper = mountWithDeps(GracePeriodBanner, {
    noPinia: true,
    global: {
      stubs: {
        Button: { template: '<button class="btn" @click="$emit(`click`, $event)"><slot /></button>' },
      },
    },
  })
  return wrapper
}

describe('GracePeriodBanner', () => {
  it('is hidden when not in grace period', () => {
    const wrapper = mountBanner(false)
    expect(wrapper.text()).toBe('')
  })

  it('shows the overdue billing copy when in grace period', () => {
    const wrapper = mountBanner(true)
    expect(wrapper.text()).toContain('Your billing is overdue.')
    expect(wrapper.text()).toContain('Renew now to keep Pro features.')
  })

  it('exposes a Renew Now action', () => {
    const wrapper = mountBanner(true)
    const renew = wrapper.findAll('button').find((b) => b.text().includes('Renew Now'))
    expect(renew).toBeDefined()
  })

  it('hides on dismiss click', async () => {
    const wrapper = mountBanner(true)
    const closeBtn = wrapper.findAll('button').at(-1)
    expect(closeBtn).toBeDefined()
    await closeBtn!.trigger('click')
    expect(wrapper.text()).toBe('')
  })
})
