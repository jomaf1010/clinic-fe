/**
 * Tests for the shared OtpInput.
 *
 * The component renders N (default 6) single-char numeric inputs and
 * coordinates focus/paste between them. It emits `update:value` on every
 * change and `complete` when all boxes are filled with digits.
 */

import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import OtpInput from './OtpInput.vue'

function mountOtp(value = '') {
  return mount(OtpInput, {
    props: { value, length: 6 },
  })
}

describe('OtpInput', () => {
  it('renders 6 single-character inputs by default', () => {
    const wrapper = mountOtp()
    expect(wrapper.findAll('input')).toHaveLength(6)
  })

  it('advances focus to the next input after typing a digit', async () => {
    const wrapper = mountOtp()
    const inputs = wrapper.findAll('input')
    const focusSpy = vi.spyOn(inputs[1]!.element, 'focus')

    await inputs[0]!.setValue('1')
    await nextTick()
    await nextTick()

    expect(focusSpy).toHaveBeenCalled()
  })

  it('moves focus back to the previous input on Backspace from an empty box', async () => {
    const wrapper = mountOtp('1')
    const inputs = wrapper.findAll('input')
    const focusSpy = vi.spyOn(inputs[0]!.element, 'focus')

    // Box 1 is empty (value="1" → only index 0 filled)
    await inputs[1]!.trigger('keydown', { key: 'Backspace' })
    await nextTick()
    await nextTick()

    expect(focusSpy).toHaveBeenCalled()
  })

  it('fills all six inputs when a 6-digit code is pasted', async () => {
    const wrapper = mountOtp()
    const first = wrapper.findAll('input')[0]!

    const clipboardData = {
      getData: () => '123456',
    } as unknown as DataTransfer

    await first.trigger('paste', { clipboardData })
    await nextTick()

    const events = wrapper.emitted('update:value') ?? []
    expect(events.at(-1)).toEqual(['123456'])
  })

  it('emits `complete` once the value reaches the configured length', async () => {
    const wrapper = mountOtp('12345')
    const lastInput = wrapper.findAll('input')[5]!

    await lastInput.setValue('6')
    await nextTick()

    const completeEvents = wrapper.emitted('complete') ?? []
    expect(completeEvents.length).toBeGreaterThan(0)
    expect(completeEvents.at(-1)).toEqual(['123456'])
  })
})
