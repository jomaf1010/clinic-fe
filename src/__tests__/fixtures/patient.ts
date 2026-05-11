interface PatientFixture {
  uuid: string
  id: string
  clinic_id: string
  first_name: string
  middle_name: string | null
  last_name: string
  full_name: string
  sex: 'male' | 'female'
  date_of_birth: string
  age: number
  contact_number: string | null
  email: string | null
  address: string | null
  blood_type: string | null
  philhealth_id: string | null
  emergency_contact: { name: string; phone: string; relationship: string } | null
  allergies: string[]
  medical_conditions: string[]
  current_medications: string[]
  created_at: string
  updated_at: string
}

export function makePatient(overrides: Partial<PatientFixture> = {}): PatientFixture {
  return {
    uuid: 'patient-fixture-uuid',
    id: 'patient-fixture-uuid',
    clinic_id: 'clinic-fixture-uuid',
    first_name: 'Juan',
    middle_name: null,
    last_name: 'Dela Cruz',
    full_name: 'Juan Dela Cruz',
    sex: 'male',
    date_of_birth: '1990-01-01',
    age: 36,
    contact_number: '+639171234567',
    email: null,
    address: null,
    blood_type: null,
    philhealth_id: null,
    emergency_contact: null,
    allergies: [],
    medical_conditions: [],
    current_medications: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}
