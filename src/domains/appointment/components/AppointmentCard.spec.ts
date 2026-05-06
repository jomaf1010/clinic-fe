import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import AppointmentCard from './AppointmentCard.vue'
import type { AppointmentResponse } from '../types/appointment.types'

function makeAppointment(overrides: Partial<AppointmentResponse> = {}): AppointmentResponse {
  return {
    id: 'appt-1',
    clinic_id: 'clinic-1',
    patient_id: 'patient-1',
    patient_name: 'Juan Dela Cruz',
    patient_avatar_url: null,
    doctor_id: 'doctor-1',
    doctor_name: 'Maria Santos',
    doctor_avatar_url: null,
    created_by: 'user-1',
    status: 'scheduled',
    scheduled_at: '2026-05-06T02:30:00.000Z',
    duration: 30,
    reason: 'Follow-up',
    cancellation_reason: null,
    cancelled_by: null,
    checked_in_at: null,
    completed_at: null,
    notes: null,
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  }
}

const STUBS = {
  AppointmentStatusBadge: {
    props: ['status'],
    template: '<span data-testid="status">{{ status }}</span>',
  },
  Button: {
    emits: ['click'],
    template: '<button v-bind="$attrs" @click="$emit(`click`, $event)"><slot /></button>',
  },
  TooltipProvider: { template: '<div><slot /></div>' },
  Tooltip: { template: '<div><slot /></div>' },
  TooltipTrigger: { template: '<div><slot /></div>' },
  TooltipContent: { template: '<div><slot /></div>' },
  DropdownMenu: { template: '<div><slot /></div>' },
  DropdownMenuTrigger: { template: '<div><slot /></div>' },
  DropdownMenuContent: { template: '<div><slot /></div>' },
  DropdownMenuItem: {
    emits: ['click'],
    template: '<button type="button" @click="$emit(`click`, $event)"><slot /></button>',
  },
  DropdownMenuSeparator: { template: '<hr />' },
}

function mountCard(appointment = makeAppointment(), canManage = true) {
  return mountWithDeps(AppointmentCard, {
    props: { appointment, canManage },
    global: { stubs: STUBS },
  })
}

describe('AppointmentCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T01:30:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders patient, doctor, reason, date, time, and relative time', () => {
    const wrapper = mountCard()

    expect(wrapper.text()).toContain('Juan Dela Cruz')
    expect(wrapper.text()).toContain('Dr. Maria Santos')
    expect(wrapper.text()).toContain('Follow-up')
    expect(wrapper.text()).toContain('May 6, 2026')
    expect(wrapper.text()).toContain('2:30 AM')
    expect(wrapper.text()).toContain('in 1h')
  })

  it('falls back to Unknown Patient when patient_name is missing', () => {
    const wrapper = mountCard(makeAppointment({ patient_name: null }))

    expect(wrapper.text()).toContain('Unknown Patient')
  })

  it('emits click when the card body is selected', async () => {
    const wrapper = mountCard()

    await wrapper.find('.appointment-list-card').trigger('click')

    expect(wrapper.emitted('click')).toEqual([['appt-1']])
  })

  it('emits scheduled management actions without triggering the card click', async () => {
    const wrapper = mountCard()

    await wrapper.findAll('button').find((button) => button.text().includes('Check In'))?.trigger('click')
    await wrapper.findAll('button').find((button) => button.text().includes('Mark No-Show'))?.trigger('click')
    await wrapper.findAll('button').find((button) => button.text().includes('Cancel Appointment'))?.trigger('click')

    expect(wrapper.emitted('check-in')).toEqual([['appt-1']])
    expect(wrapper.emitted('no-show')).toEqual([['appt-1']])
    expect(wrapper.emitted('cancel')).toEqual([['appt-1']])
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('hides management actions when appointment is not scheduled or user cannot manage', () => {
    const completed = mountCard(makeAppointment({ status: 'completed' }))
    const readOnly = mountCard(makeAppointment(), false)

    expect(completed.text()).not.toContain('Check In')
    expect(readOnly.text()).not.toContain('Check In')
  })
})
