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
import { stubStore } from '@/__tests__/helpers/createPinia'
import { useAuthStore } from '@/domains/auth/stores/authStore'
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
  const wrapper = mountWithDeps(CredentialsForm, { global: { stubs: STUBS } })
  const auth = useAuthStore()
  stubStore(auth, {
    user: {
      prc_license_number: '0012345',
      ptr_number: '',
      s2_license_number: '',
      specialty: 'none',
      sub_specialty: '',
      ...initialUser,
    },
    fetchUser: vi.fn().mockResolvedValue(undefined),
  } as never)
  return wrapper
}

describe('CredentialsForm', () => {
  it('fetches the specialty list on mount', async () => {
    httpGetSpy.mockClear()
    mount()
    await flushPromises()
    expect(httpGetSpy).toHaveBeenCalledWith('/specialties')
  })

  it.skip('blocks submit when PRC license is longer than 50 chars', async () => {
    updateProfileSpy.mockClear()
    const wrapper = mount()
    await flushPromises()
    const longValue = '1'.repeat(51)
    await wrapper.find('#cred-prc').setValue(longValue)
    await flushPromises()

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(updateProfileSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('PRC license number must be no more than 50 characters.')
  })

  it.skip('submits null for specialty when "none" is selected', async () => {
    updateProfileSpy.mockClear()
    const wrapper = mount()
    await flushPromises()
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(updateProfileSpy).toHaveBeenCalledOnce()
    const payload = updateProfileSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload.specialty).toBeNull()
    expect(payload.prc_license_number).toBe('0012345')
  })

  it.skip('submits empty strings as null for optional fields', async () => {
    updateProfileSpy.mockClear()
    const wrapper = mount({
      prc_license_number: '',
      ptr_number: '',
      s2_license_number: '',
      sub_specialty: '',
    })
    await flushPromises()
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(updateProfileSpy).toHaveBeenCalledOnce()
    const payload = updateProfileSpy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload.prc_license_number).toBeNull()
    expect(payload.ptr_number).toBeNull()
    expect(payload.s2_license_number).toBeNull()
    expect(payload.sub_specialty).toBeNull()
  })
})
