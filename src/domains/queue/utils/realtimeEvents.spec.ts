import { describe, expect, it } from 'vitest'
import type { QueueVisitResponse } from '../types/queue.types'
import { mergeQueueRealtimeEvent } from './realtimeEvents'

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
    encounter_id: null,
    status: 'waiting',
    type: 'walk_in',
    priority: 0,
    position: 1,
    reason: 'Consultation',
    checked_in_at: '2026-05-06T01:00:00.000Z',
    called_at: null,
    completed_at: null,
    notes: null,
    created_at: '2026-05-06T01:00:00.000Z',
    updated_at: '2026-05-06T01:00:00.000Z',
    ...overrides,
  }
}

describe('mergeQueueRealtimeEvent', () => {
  it('adds new queue visits and replaces existing visits for known events', () => {
    const first = makeVisit({ id: 'visit-1', position: 1 })
    const replacement = makeVisit({ id: 'visit-1', position: 2 })
    const called = makeVisit({ id: 'visit-2', status: 'in_progress' })

    const created = mergeQueueRealtimeEvent([], { type: 'queue.visit.created', data: first })
    const replaced = mergeQueueRealtimeEvent(created, { type: 'queue.visit.created', data: replacement })
    const withCalled = mergeQueueRealtimeEvent(replaced, { type: 'queue.visit.called', data: called })

    expect(withCalled).toHaveLength(2)
    expect(withCalled[0]?.position).toBe(2)
    expect(withCalled[1]?.status).toBe('in_progress')
  })

  it('ignores unknown queue realtime events', () => {
    const visits = [makeVisit()]

    expect(mergeQueueRealtimeEvent(visits, { type: 'queue.visit.unknown', data: makeVisit({ id: 'visit-2' }) })).toBe(visits)
  })
})
