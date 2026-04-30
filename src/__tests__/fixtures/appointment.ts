interface AppointmentFixture {
  uuid: string
  id: string
  clinic_id: string
  patient_id: string
  doctor_id: string | null
  scheduled_at: string
  duration_minutes: number
  status: 'scheduled' | 'confirmed' | 'arrived' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show'
  visit_reason: string | null
  type: 'consultation' | 'follow_up' | 'dental' | 'prenatal'
  notes: string | null
  created_at: string
  updated_at: string
}

export function makeAppointment(overrides: Partial<AppointmentFixture> = {}): AppointmentFixture {
  return {
    uuid: 'appointment-fixture-uuid',
    id: 'appointment-fixture-uuid',
    clinic_id: 'clinic-fixture-uuid',
    patient_id: 'patient-fixture-uuid',
    doctor_id: 'user-fixture-uuid',
    scheduled_at: '2026-05-01T10:00:00Z',
    duration_minutes: 30,
    status: 'scheduled',
    visit_reason: null,
    type: 'consultation',
    notes: null,
    created_at: '2026-04-30T10:00:00Z',
    updated_at: '2026-04-30T10:00:00Z',
    ...overrides,
  }
}
