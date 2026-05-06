import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import QueueCard from './QueueCard.vue'
import type { QueueVisitResponse } from '../types/queue.types'

const pushMock = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

const STUBS = {
  Badge: { template: '<span><slot /></span>' },
  Button: {
    emits: ['click'],
    template: '<button type="button" @click="$emit(`click`, $event)"><slot /></button>',
  },
  PatientAvatar: { template: '<span data-testid="avatar" />' },
  QueueStatusBadge: {
    props: ['status'],
    template: '<span data-testid="status">{{ status }}</span>',
  },
}

function makeVisit(overrides: Partial<QueueVisitResponse> = {}): QueueVisitResponse {
  return {
    id: 'visit-1',
    clinic_id: 'clinic-1',
    patient_id: 'patient-1',
    patient_name: 'Juan Dela Cruz',
    patient_sex: 'male',
    patient_avatar_url: null,
    doctor_id: 'doctor-1',
    doctor_name: 'Maria Santos',
    appointment_id: null,
    encounter_id: 'encounter-1',
    status: 'waiting',
    type: 'walk_in',
    priority: 0,
    position: 3,
    reason: 'Follow-up',
    checked_in_at: '2026-05-06T01:00:00.000Z',
    called_at: null,
    completed_at: null,
    notes: null,
    created_at: '2026-05-06T01:00:00.000Z',
    updated_at: '2026-05-06T01:00:00.000Z',
    ...overrides,
  }
}

function mountCard(visit = makeVisit(), props: Record<string, unknown> = {}) {
  return mountWithDeps(QueueCard, {
    props: {
      visit,
      canManage: true,
      canCall: true,
      currentUserId: 'doctor-1',
      ...props,
    },
    global: { stubs: STUBS },
  })
}

describe('QueueCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T01:45:00.000Z'))
    pushMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders patient, position, doctor, reason, type, status, and wait time', () => {
    const wrapper = mountCard()

    expect(wrapper.text()).toContain('#3')
    expect(wrapper.text()).toContain('Juan Dela Cruz')
    expect(wrapper.text()).toContain('Dr. Maria Santos')
    expect(wrapper.text()).toContain('Follow-up')
    expect(wrapper.text()).toContain('Walk-in')
    expect(wrapper.text()).toContain('waiting')
    expect(wrapper.text()).toContain('45m')
  })

  it('shows carryover detail for an active visit from a previous day', () => {
    const wrapper = mountCard(makeVisit({ checked_in_at: '2026-05-05T23:00:00.000Z' }))

    expect(wrapper.text()).toContain('From May 5')
    expect(wrapper.classes()).toContain('border-amber-300')
  })

  it('emits waiting actions when the user can manage the queue', async () => {
    const wrapper = mountCard()

    await wrapper.findAll('button').find((button) => button.text().includes('Call'))?.trigger('click')
    await wrapper.findAll('button').find((button) => !button.text().trim())?.trigger('click')

    expect(wrapper.emitted('call')).toEqual([['visit-1']])
    expect(wrapper.emitted('cancel')).toEqual([['visit-1']])
  })

  it('emits complete for an in-progress visit assigned to the current doctor', async () => {
    const wrapper = mountCard(makeVisit({ status: 'in_progress' }), { canManage: false, canCall: true })

    await wrapper.findAll('button').find((button) => button.text().includes('Complete'))?.trigger('click')

    expect(wrapper.emitted('complete')).toEqual([['visit-1']])
    expect(wrapper.text()).not.toContain('Call')
  })

  it('hides action buttons when the user cannot act on the visit', () => {
    const wrapper = mountCard(makeVisit({ doctor_id: 'doctor-2' }), { canManage: false, canCall: true })

    expect(wrapper.text()).not.toContain('Call')
    expect(wrapper.text()).not.toContain('Complete')
  })

  it('opens the linked consultation when present', async () => {
    const wrapper = mountCard()

    await wrapper.findAll('button').find((button) => button.text().includes('Consultation'))?.trigger('click')

    expect(pushMock).toHaveBeenCalledWith({
      name: 'encounter-detail',
      params: {
        patientId: 'patient-1',
        id: 'encounter-1',
      },
    })
  })
})
