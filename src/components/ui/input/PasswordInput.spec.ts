import { describe, expect, it } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import PasswordInput from './PasswordInput.vue'

describe('PasswordInput', () => {
  it('exposes a keyboard-focusable password reveal control with an accessible label', async () => {
    const wrapper = mountWithDeps(PasswordInput, {
      global: {
        stubs: {
          Eye: true,
          EyeOff: true,
        },
      },
    })

    const button = wrapper.get('button[type="button"]')

    expect(button.attributes('tabindex')).toBeUndefined()
    expect(button.attributes('aria-label')).toBe('Show password')
    expect(wrapper.get('input').attributes('type')).toBe('password')

    await button.trigger('click')

    expect(button.attributes('aria-label')).toBe('Hide password')
    expect(wrapper.get('input').attributes('type')).toBe('text')
  })
})
