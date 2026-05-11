/**
 * Tests for PasswordForm.
 *
 * Covers the change-password form's vee-validate behaviour:
 *   - Submit blocks when required fields are blank.
 *   - Min-length rule on `new_password` blocks short passwords.
 *   - Mismatch between new_password and confirmation surfaces an error
 *     and skips the API call.
 *   - Happy-path submit base64-encodes the passwords (project convention).
 *   - 422 from the API surfaces server-side field errors.
 */

import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import { HttpError } from '@/lib/http'
import PasswordForm from './PasswordForm.vue'

// `vi.mock` is hoisted to the top of the file; the spies it references must
// be created via `vi.hoisted` so they exist by the time the import-time
// factories run. Top-level `const`s would still be `undefined` at that point.
const { changePasswordSpy, toastSuccess } = vi.hoisted(() => ({
  changePasswordSpy: vi.fn(),
  toastSuccess: vi.fn(),
}))
changePasswordSpy.mockResolvedValue(undefined)

vi.mock('../api/authApi', () => ({
  authApi: { changePassword: (...args: unknown[]) => changePasswordSpy(...args) },
}))

vi.mock('vue-sonner', () => ({
  toast: { success: toastSuccess },
}))

// PasswordStrengthBar pulls in zxcvbn or similar; stub it to keep the spec
// focused on validation + submit shape.
vi.mock('./PasswordStrengthBar.vue', () => ({
  default: { name: 'PasswordStrengthBar', template: '<div />' },
}))

const STUBS = {
  Card: { template: '<div><slot /></div>' },
  CardHeader: { template: '<div><slot /></div>' },
  CardTitle: { template: '<div><slot /></div>' },
  CardDescription: { template: '<div><slot /></div>' },
  CardContent: { template: '<div><slot /></div>' },
  CardFooter: { template: '<div><slot /></div>' },
  Separator: { template: '<hr />' },
  Label: { template: '<label><slot /></label>' },
  Button: { template: '<button v-bind="$attrs"><slot /></button>' },
  Input: {
    name: 'Input',
    props: ['modelValue', 'type', 'id'],
    emits: ['update:modelValue'],
    template: `<input :id="id" :type="type" :value="modelValue ?? ''" @input="$emit('update:modelValue', ($event.target).value)" />`,
  },
  PasswordInput: {
    name: 'PasswordInput',
    props: ['modelValue', 'id'],
    emits: ['update:modelValue'],
    template: `<input :id="id" type="password" :value="modelValue ?? ''" @input="$emit('update:modelValue', ($event.target).value)" />`,
  },
}

function setField(wrapper: ReturnType<typeof mountWithDeps>, id: string, value: string) {
  const el = wrapper.find(`#${id}`)
  return el.setValue(value)
}

describe('PasswordForm', () => {
  it('blocks submit when fields are empty and surfaces required errors', async () => {
    changePasswordSpy.mockClear()
    const wrapper = mountWithDeps(PasswordForm, { global: { stubs: STUBS } })
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(changePasswordSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Current password is required.')
    expect(wrapper.text()).toContain('New password is required.')
    expect(wrapper.text()).toContain('Password confirmation is required.')
  })

  it('blocks submit when new password is shorter than 10 characters', async () => {
    changePasswordSpy.mockClear()
    const wrapper = mountWithDeps(PasswordForm, { global: { stubs: STUBS } })

    await setField(wrapper, 'current-password', 'oldpass1234')
    await setField(wrapper, 'new-password', 'short')
    await setField(wrapper, 'new-password-confirmation', 'short')
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(changePasswordSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('New password must be at least 10 characters.')
  })

  it('surfaces a mismatch error and does not call the API when confirmations differ', async () => {
    changePasswordSpy.mockClear()
    const wrapper = mountWithDeps(PasswordForm, { global: { stubs: STUBS } })

    await setField(wrapper, 'current-password', 'oldpass1234')
    await setField(wrapper, 'new-password', 'newpass-1234')
    await setField(wrapper, 'new-password-confirmation', 'different-1234')
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(changePasswordSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Passwords do not match.')
  })

  it('submits base64-encoded passwords on the happy path', async () => {
    changePasswordSpy.mockClear()
    toastSuccess.mockClear()
    const wrapper = mountWithDeps(PasswordForm, { global: { stubs: STUBS } })

    await setField(wrapper, 'current-password', 'oldpass1234')
    await setField(wrapper, 'new-password', 'newpass-1234')
    await setField(wrapper, 'new-password-confirmation', 'newpass-1234')
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(changePasswordSpy).toHaveBeenCalledOnce()
    const payload = changePasswordSpy.mock.calls[0]?.[0] as {
      current_password: string
      new_password: string
      new_password_confirmation: string
    }
    expect(payload.current_password).toBe(btoa('oldpass1234'))
    expect(payload.new_password).toBe(btoa('newpass-1234'))
    expect(payload.new_password_confirmation).toBe(btoa('newpass-1234'))
    expect(toastSuccess).toHaveBeenCalledWith('Password changed successfully.')
  })

  it('surfaces 422 field errors from changePassword', async () => {
    changePasswordSpy.mockRejectedValueOnce(new HttpError(422, 'Invalid', {
      message: 'Please review your password.',
      errors: {
        current_password: ['Current password is incorrect.'],
      },
    }))
    const wrapper = mountWithDeps(PasswordForm, { global: { stubs: STUBS } })

    await setField(wrapper, 'current-password', 'oldpass1234')
    await setField(wrapper, 'new-password', 'newpass-1234')
    await setField(wrapper, 'new-password-confirmation', 'newpass-1234')
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Please review your password.')
    expect(wrapper.text()).toContain('Current password is incorrect.')
  })

  it('uses the fallback validation message for 422 responses without a message', async () => {
    changePasswordSpy.mockRejectedValueOnce(new HttpError(422, 'Invalid', { errors: {} }))
    const wrapper = mountWithDeps(PasswordForm, { global: { stubs: STUBS } })

    await setField(wrapper, 'current-password', 'oldpass1234')
    await setField(wrapper, 'new-password', 'newpass-1234')
    await setField(wrapper, 'new-password-confirmation', 'newpass-1234')
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Validation failed.')
  })

  it('surfaces a generic message when changePassword fails unexpectedly', async () => {
    changePasswordSpy.mockRejectedValueOnce(new Error('server unavailable'))
    const wrapper = mountWithDeps(PasswordForm, { global: { stubs: STUBS } })

    await setField(wrapper, 'current-password', 'oldpass1234')
    await setField(wrapper, 'new-password', 'newpass-1234')
    await setField(wrapper, 'new-password-confirmation', 'newpass-1234')
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('An unexpected error occurred. Please try again.')
  })
})
