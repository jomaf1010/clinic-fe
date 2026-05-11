interface PrescriptionItem {
  medicine_id: string | null
  drug_name: string
  dose: string
  route: string
  frequency: string
  duration: string | null
  quantity: number
  unit_price: number
  is_multi_dose: boolean
  doses_per_unit: number
  dispensed_quantity?: number
  notes?: string | null
}

interface PrescriptionFixture {
  uuid: string
  id: string
  clinic_id: string
  patient_id: string
  encounter_id: string
  doctor_id: string
  items: PrescriptionItem[]
  notes: string | null
  pdf_url: string | null
  generated_at: string | null
  created_at: string
  updated_at: string
}

export function makePrescription(overrides: Partial<PrescriptionFixture> = {}): PrescriptionFixture {
  return {
    uuid: 'prescription-fixture-uuid',
    id: 'prescription-fixture-uuid',
    clinic_id: 'clinic-fixture-uuid',
    patient_id: 'patient-fixture-uuid',
    encounter_id: 'encounter-fixture-uuid',
    doctor_id: 'user-fixture-uuid',
    items: [],
    notes: null,
    pdf_url: null,
    generated_at: null,
    created_at: '2026-04-30T10:00:00Z',
    updated_at: '2026-04-30T10:00:00Z',
    ...overrides,
  }
}

export function makePrescriptionItem(overrides: Partial<PrescriptionItem> = {}): PrescriptionItem {
  return {
    medicine_id: 'medicine-fixture-uuid',
    drug_name: 'Paracetamol 500mg',
    dose: '1 tab',
    route: 'PO',
    frequency: 'q6h prn',
    duration: '5 days',
    quantity: 20,
    unit_price: 5,
    is_multi_dose: false,
    doses_per_unit: 1,
    ...overrides,
  }
}
