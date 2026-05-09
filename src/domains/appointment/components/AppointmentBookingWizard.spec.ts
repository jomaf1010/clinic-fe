import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import AppointmentBookingWizard from './AppointmentBookingWizard.vue'

const mocks = vi.hoisted(() => ({
  reschedule: vi.fn().mockResolvedValue({ data: {} }),
  createAppointment: vi.fn(),
}))

vi.mock('../api/appointmentApi', () => ({
  appointmentApi: {
    getDoctors: vi.fn().mockResolvedValue({ data: [] }),
    reschedule: mocks.reschedule,
  },
}))

vi.mock('../stores/appointmentStore', () => ({
  useAppointmentStore: () => ({
    isCreating: false,
    createAppointment: mocks.createAppointment,
  }),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const STUBS = {
  Button: {
    props: ['disabled'],
    emits: ['click'],
    template: '<button type="button" :disabled="disabled" @click="$emit(`click`, $event)"><slot /></button>',
  },
  Dialog: { template: '<div><slot /></div>' },
  DialogContent: { template: '<div><slot /></div>' },
  DialogFooter: { template: '<div><slot /></div>' },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<h2><slot /></h2>' },
  Input: { template: '<input />' },
  Label: { template: '<label><slot /></label>' },
  Textarea: { template: '<textarea />' },
  DateSlotPicker: {
    emits: ['update:modelValue'],
    mounted() {
      this.$emit('update:modelValue', '2026-05-08T10:00:00Z')
    },
    template: '<div />',
  },
  PatientSelector: { template: '<div />' },
}

describe('AppointmentBookingWizard reschedule', () => {
  it('sends the expected updated timestamp when rescheduling', async () => {
    const wrapper = mountWithDeps(AppointmentBookingWizard, {
      props: {
        open: false,
        mode: 'reschedule',
        appointmentId: 'appointment-1',
        expectedUpdatedAt: '2026-05-08T09:00:00Z',
        prefillDoctorId: 'doctor-1',
      },
      global: { stubs: STUBS },
    })

    await wrapper.setProps({ open: true })
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text().includes('Reschedule'))?.trigger('click')

    expect(mocks.reschedule).toHaveBeenCalledWith(
      'appointment-1',
      '2026-05-08T10:00:00Z',
      '2026-05-08T09:00:00Z',
    )
  })
})
