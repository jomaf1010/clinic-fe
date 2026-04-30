interface ClinicFixture {
  uuid: string
  id: string
  name: string
  slug: string
  owner_user_id: string
  specialties: string[]
  settings: {
    default_consultation_fee?: number | null
    default_follow_up_fee?: number | null
    billing_supplies_as_clinic_revenue?: boolean
    auto_generate_prescription_pdf?: boolean
    tooth_numbering?: 'fdi' | 'universal' | 'palmer'
    [key: string]: unknown
  }
  subscription: {
    plan: 'free' | 'pro'
    is_trial: boolean
    trial_ends_at: string | null
  }
  created_at: string
  updated_at: string
}

export function makeClinic(overrides: Partial<ClinicFixture> = {}): ClinicFixture {
  return {
    uuid: 'clinic-fixture-uuid',
    id: 'clinic-fixture-uuid',
    name: 'Test Clinic',
    slug: 'test-clinic',
    owner_user_id: 'user-fixture-uuid',
    specialties: ['general'],
    settings: {
      default_consultation_fee: 500,
      default_follow_up_fee: 300,
      billing_supplies_as_clinic_revenue: true,
      auto_generate_prescription_pdf: true,
      tooth_numbering: 'fdi',
    },
    subscription: {
      plan: 'pro',
      is_trial: false,
      trial_ends_at: null,
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}
