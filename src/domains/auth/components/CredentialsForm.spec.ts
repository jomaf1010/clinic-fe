/**
 * Tests for CredentialsForm.
 *
 * The form mounts, fetches `/specialties`, and lets the dentist update PRC /
 * PTR / S2 / specialty / sub-specialty. There's no e-mail or password rule
 * here (despite the name) — this is the *professional credentials* form.
 *
 * Coverage:
 *   - Initial values populate from `authStore.user`.
 *   - maxLength(50) on PRC license number blocks submission with a >50 char
 *     value.
 *   - Happy submit hits authApi.updateProfile with the right payload shape
 *     (including the `specialty: null` mapping when "none" is selected).
 *   - The /specialties fetch on mount populates the dropdown options.
 */

import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import { setupTestPinia } from '@/__tests__/helpers/createPinia'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { HttpError } from '@/lib/http'
import CredentialsForm from './CredentialsForm.vue'

const updateProfileSpy = vi.fn().mockResolvedValue(undefined)
vi.mock('../api/authApi', () => ({
  authApi: { updateProfile: (...args: unknown[]) => updateProfileSpy(...args) },
}))

const httpGetSpy = vi.fn().mockResolvedValue({ data: [{ key: 'family_medicine', display_name: 'Family Medicine' }] })
vi.mock('@/lib/http', () => ({
  http: { get: (...args: unknown[]) => httpGetSpy(...args) },
  HttpError: class HttpError extends Error {
    status = 0
    data: unknown
    constructor(status: number, message: string, data?: unknown) {
      super(message)
      this.status = status
      this.data = data
    }
  },
}))

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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
  Button: { template: '<button type="submit" v-bind="$attrs" @click="$emit(`click`, $event)"><slot /></button>' },
  Input: {
    name: 'Input',
    props: ['modelValue', 'type', 'id'],
    emits: ['update:modelValue'],
    template: `<input :id="id" :type="type" :value="modelValue ?? ''" @input="$emit('update:modelValue', ($event.target).value)" />`,
  },
  Select: {
    name: 'Select',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div class="select-stub"><slot /></div>',
  },
  SelectContent: { template: '<div><slot /></div>' },
  SelectItem: { template: '<div><slot /></div>' },
  SelectTrigger: { template: '<div><slot /></div>' },
  SelectValue: { template: '<div />' },
}

function mount(initialUser: Record<string, unknown> = {}) {
  setupTestPinia()
  const auth = useAuthStore()
  auth.user = {
    prc_license_number: '0012345',
    ptr_number: '',
    s2_license_number: '',
    specialty: 'none',
    sub_specialty: '',
    ...initialUser,
  } as never
  auth.fetchUser = vi.fn().mockResolvedValue(undefined)
  const wrapper = mountWithDeps(CredentialsForm, {
    noPinia: true,
    global: { stubs: STUBS },
  })
  return wrapper
}

describe('CredentialsForm', () => {
  it('fetches the specialty list on mount', async () => {
    httpGetSpy.mockClear()
    mount()
    await flushPromises()
    expect(httpGetSpy).toHaveBeenCalledWith('/specialties')
  })

  it('silently keeps the specialty dropdown empty when the fetch fails', async () => {
    httpGetSpy.mockRejectedValueOnce(new Error('network down'))
    const wrapper = mount()
    await flushPromises()

    expect(httpGetSpy).toHaveBeenCalledWith('/specialties')
    expect(wrapper.text()).not.toContain('Family Medicine')
  })

  it('blocks submit when PRC license is longer than 50 chars', async () => {
    updateProfileSpy.mockClear()
    const wrapper = mount()
    await flushPromises()
    const longValue = '1'.repeat(51)
    await wrapper.find('#cred-prc').setValue(longValue)
    await flushPromises()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(updateProfileSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('PRC license number must be no more than 50 characters.')
  })

  it('blocks submit and renders specialty field validation errors', async () => {
    updateProfileSpy.mockClear()
    const wrapper = mount({
      specialty: 's'.repeat(256),
      sub_specialty: 'x'.repeat(256),
    })
    await flushPromises()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(updateProfileSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Specialty must be no more than 255 characters.')
    expect(wrapper.text()).toContain('Sub-specialty must be no more than 255 characters.')
  })

  it('blocks submit and renders PTR and S2 field validation errors', async () => {
    updateProfileSpy.mockClear()
    const wrapper = mount()
    await flushPromises()
    await wrapper.find('#cred-ptr').setValue('2'.repeat(51))
    await wrapper.find('#cred-s2').setValue('3'.repeat(51))
    await flushPromises()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(updateProfileSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('PTR number must be no more than 50 characters.')
    expect(wrapper.text()).toContain('S2 license number must be no more than 50 characters.')
  })

  it('submits null for specialty when "none" is selected', async () => {
    updateProfileSpy.mockClear()
    const wrapper = mount()
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(updateProfileSpy).toHaveBeenCalledOnce()
    const payload = updateProfileSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload.specialty).toBeNull()
    expect(payload.prc_license_number).toBe('0012345')
  })

  it('submits empty strings as null for optional fields', async () => {
    updateProfileSpy.mockClear()
    const wrapper = mount({
      prc_license_number: '',
      ptr_number: '',
      s2_license_number: '',
      sub_specialty: '',
    })
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(updateProfileSpy).toHaveBeenCalledOnce()
    const payload = updateProfileSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload.prc_license_number).toBeNull()
    expect(payload.ptr_number).toBeNull()
    expect(payload.s2_license_number).toBeNull()
    expect(payload.sub_specialty).toBeNull()
  })

  it('submits the selected specialty when it is not "none"', async () => {
    updateProfileSpy.mockClear()
    const wrapper = mount({
      specialty: 'family_medicine',
      sub_specialty: 'Geriatrics',
    })
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(updateProfileSpy).toHaveBeenCalledOnce()
    const payload = updateProfileSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload.specialty).toBe('family_medicine')
    expect(payload.sub_specialty).toBe('Geriatrics')
  })

  it('shows the saving state while updateProfile is pending', async () => {
    let resolveUpdate: (() => void) | undefined
    updateProfileSpy.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveUpdate = resolve
    }))
    const wrapper = mount()
    await flushPromises()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Saving...')

    resolveUpdate?.()
    await flushPromises()

    expect(wrapper.text()).toContain('Save credentials')
  })

  it('surfaces 422 field errors from updateProfile', async () => {
    updateProfileSpy.mockRejectedValueOnce(new HttpError(422, 'Invalid', {
      message: 'Please review your credentials.',
      errors: {
        ptr_number: ['PTR number is invalid.'],
      },
    }))
    const wrapper = mount()
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Please review your credentials.')
    expect(wrapper.text()).toContain('PTR number is invalid.')
  })

  it('uses the fallback validation message for 422 responses without a message', async () => {
    updateProfileSpy.mockRejectedValueOnce(new HttpError(422, 'Invalid', { errors: {} }))
    const wrapper = mount()
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Validation failed.')
  })

  it('surfaces a generic message when updateProfile fails unexpectedly', async () => {
    updateProfileSpy.mockRejectedValueOnce(new Error('server unavailable'))
    const wrapper = mount()
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('An unexpected error occurred. Please try again.')
  })
})
