interface EncounterFixture {
  uuid: string
  id: string
  clinic_id: string
  patient_id: string
  doctor_id: string | null
  type: 'consultation' | 'dental' | 'prenatal' | 'delivery' | 'postpartum'
  status: 'draft' | 'in_progress' | 'finalized' | 'cancelled' | 'discarded'
  visit_at: string
  display_line: string | null
  display_summary: string | null
  procedures: Array<{
    service_id?: string | null
    name: string
    quantity: number
    unit_price?: number
  }>
  consumables: Array<{ name: string; quantity: number; unit_price: number }>
  payment: {
    fee_discount_type?: 'percentage' | 'fixed' | null
    fee_discount_value?: number
    [key: string]: unknown
  }
  created_at: string
  updated_at: string
}

export function makeEncounter(overrides: Partial<EncounterFixture> = {}): EncounterFixture {
  return {
    uuid: 'encounter-fixture-uuid',
    id: 'encounter-fixture-uuid',
    clinic_id: 'clinic-fixture-uuid',
    patient_id: 'patient-fixture-uuid',
    doctor_id: 'user-fixture-uuid',
    type: 'consultation',
    status: 'draft',
    visit_at: '2026-04-30T10:00:00Z',
    display_line: null,
    display_summary: null,
    procedures: [],
    consumables: [],
    payment: {},
    created_at: '2026-04-30T10:00:00Z',
    updated_at: '2026-04-30T10:00:00Z',
    ...overrides,
  }
}
