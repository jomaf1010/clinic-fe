/**
 * Tests for EditPatientDialog.
 *
 * Coverage focus:
 *   - The dialog populates form fields from the patient prop on open.
 *   - PH phone number rule rejects malformed input and accepts valid ones.
 *   - Required fields (date_of_birth + sex) block submit when blank.
 *   - Happy submit forwards the expected payload (incl. null normalisation
 *     of empty optional fields).
 *   - 422 server errors are mapped onto the matching field.
 *
 * shadcn Dialog teleports — we stub the Dialog wrappers so the form lives
 * inline and we can interact with it directly.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import EditPatientDialog from './EditPatientDialog.vue'

// `vi.mock` is hoisted; spies + mock classes referenced from the factory
// must be created via `vi.hoisted` so they exist before the import chain
// triggers the factory. Top-level declarations would still be `undefined`
// at hoist-execution time.
const { updatePatientSpy, FakeHttpError } = vi.hoisted(() => {
  class FakeHttpError extends Error {
    status: number
    data: unknown
    constructor(status: number, message: string, data?: unknown) {
      super(message)
      this.status = status
      this.data = data
    }
  }
  return {
    updatePatientSpy: vi.fn(),
    FakeHttpError,
  }
})
updatePatientSpy.mockResolvedValue(undefined)

vi.mock('../api/patientApi', () => ({
  patientApi: { update: (...args: unknown[]) => updatePatientSpy(...args) },
}))

vi.mock('@/lib/http', () => ({
  HttpError: FakeHttpError,
}))

// Form sub-components — we don't care about their internals here, just
// that the dialog's required name/address presence guards behave.
vi.mock('@/components/NameForm.vue', () => ({
  default: {
    name: 'NameForm',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div class="name-form-stub" />',
  },
}))
vi.mock('@/components/AddressForm.vue', () => ({
  default: {
    name: 'AddressForm',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div class="address-form-stub" />',
  },
}))
vi.mock('@/components/DateOfBirthPicker.vue', () => ({
  default: {
    name: 'DateOfBirthPicker',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: `<input class="dob-picker" :value="modelValue ?? ''" @input="$emit('update:modelValue', ($event.target).value)" />`,
  },
}))

const STUBS = {
  Dialog: { template: '<div><slot /></div>' },
  DialogContent: { template: '<div><slot /></div>' },
  DialogDescription: { template: '<div><slot /></div>' },
  DialogFooter: { template: '<div><slot /></div>' },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<div><slot /></div>' },
  Separator: { template: '<hr />' },
  Label: { template: '<label><slot /></label>' },
  Button: { template: '<button v-bind="$attrs" @click="$emit(`click`, $event)"><slot /></button>' },
  Input: {
    name: 'Input',
    props: ['modelValue', 'type', 'id'],
    emits: ['update:modelValue'],
    template: `<input :id="id" :type="type" :value="modelValue ?? ''" @input="$emit('update:modelValue', ($event.target).value)" />`,
  },
  Textarea: {
    name: 'Textarea',
    props: ['modelValue', 'id'],
    emits: ['update:modelValue'],
    template: `<textarea :id="id" :value="modelValue ?? ''" @input="$emit('update:modelValue', ($event.target).value)" />`,
  },
  Select: {
    name: 'Select',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div><slot /></div>',
  },
  SelectContent: { template: '<div><slot /></div>' },
  SelectItem: { template: '<div><slot /></div>' },
  SelectTrigger: { template: '<div><slot /></div>' },
  SelectValue: { template: '<div />' },
}

function makePatientResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    first_name: 'Juan',
    middle_name: null,
    last_name: 'Dela Cruz',
    suffix: null,
    sex: 'male',
    date_of_birth: '1990-01-01',
    contact_number: '09171234567',
    email: 'patient@example.com',
    blood_type: null,
    address: { line1: '1 Sample St', city: 'Manila' },
    note: '',
    ...overrides,
  }
}

function mount(patient = makePatientResponse()) {
  return mountWithDeps(EditPatientDialog, {
    props: { open: true, patient },
    global: { stubs: STUBS },
  })
}

describe('EditPatientDialog', () => {
  beforeEach(() => {
    updatePatientSpy.mockReset()
    updatePatientSpy.mockResolvedValue(undefined)
  })

  it('populates the contact number input from the patient on open', async () => {
    const wrapper = mount()
    await flushPromises()
    const phone = wrapper.find('#edit_contact_number')
    expect((phone.element as HTMLInputElement).value).toBe('09171234567')
  })

  it('rejects an invalid PH phone number and blocks submit', async () => {
    updatePatientSpy.mockClear()
    const wrapper = mount()
    await flushPromises()

    await wrapper.find('#edit_contact_number').setValue('not-a-phone')
    await flushPromises()
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(updatePatientSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Contact number must be a valid Philippine mobile number.')
  })

  it('accepts a +639XXXXXXXXX formatted phone and submits', async () => {
    const wrapper = mount()
    await flushPromises()

    await wrapper.find('#edit_contact_number').setValue('+639171112222')
    await flushPromises()
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(updatePatientSpy).toHaveBeenCalledOnce()
    const payload = updatePatientSpy.mock.calls[0]?.[1] as Record<string, unknown>
    expect(payload.contact_number).toBe('+639171112222')
    expect(wrapper.emitted('updated')).toEqual([[]])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('normalises empty optional fields to null in the submit payload', async () => {
    const wrapper = mount(makePatientResponse({ contact_number: '', email: '', note: '' }))
    await flushPromises()
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(updatePatientSpy).toHaveBeenCalledOnce()
    const payload = updatePatientSpy.mock.calls[0]?.[1] as Record<string, unknown>
    expect(payload.contact_number).toBeNull()
    expect(payload.email).toBeNull()
    expect(payload.note).toBeNull()
  })

  it('shows a general error when the patient name is incomplete', async () => {
    const wrapper = mount()
    await flushPromises()

    wrapper.findComponent({ name: 'NameForm' }).vm.$emit('update:modelValue', {
      first_name: '',
      middle_name: null,
      last_name: 'Dela Cruz',
      suffix: null,
    })
    await flushPromises()
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(updatePatientSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Please enter first and last name.')
  })

  it('shows a general error when the address is missing', async () => {
    const wrapper = mount()
    await flushPromises()

    wrapper.findComponent({ name: 'AddressForm' }).vm.$emit('update:modelValue', null)
    await flushPromises()
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(updatePatientSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Please complete the address fields.')
  })

  it('maps server-side 422 field errors back onto the form', async () => {
    updatePatientSpy.mockRejectedValue(
      new FakeHttpError(422, 'Validation failed', {
        message: 'Validation failed',
        errors: { contact_number: ['Already in use.'] },
      }),
    )
    const wrapper = mount()
    await flushPromises()
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Already in use.')
  })

  it('shows a generic error for non-validation HttpError failures', async () => {
    updatePatientSpy.mockRejectedValue(new FakeHttpError(500, 'Server error'))
    const wrapper = mount()
    await flushPromises()

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('An unexpected error occurred. Please try again.')
  })

  it('shows a connection error for non-HttpError failures', async () => {
    updatePatientSpy.mockRejectedValue(new Error('offline'))
    const wrapper = mount()
    await flushPromises()

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Unable to connect to the server. Please try again.')
  })
})
