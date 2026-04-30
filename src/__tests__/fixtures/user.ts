/**
 * User fixture for tests.
 *
 * Mirrors a typical authenticated user. Tests pass `overrides` to twist
 * specific fields (e.g., `{ specialty: 'dental' }` for dentist scope).
 */

interface UserFixture {
  uuid: string
  id: string
  name: string
  email: string
  email_verified_at: string | null
  specialty: string | null
  consultation_fee: number | null
  follow_up_fee: number | null
  specialty_fees: Record<string, number> | null
  preferences: Record<string, unknown>
  created_at: string
  updated_at: string
}

export function makeUser(overrides: Partial<UserFixture> = {}): UserFixture {
  return {
    uuid: 'user-fixture-uuid',
    id: 'user-fixture-uuid',
    name: 'Dr. Test User',
    email: 'test@example.com',
    email_verified_at: '2026-01-01T00:00:00Z',
    specialty: null,
    consultation_fee: null,
    follow_up_fee: null,
    specialty_fees: null,
    preferences: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export function makeDentist(overrides: Partial<UserFixture> = {}): UserFixture {
  return makeUser({
    name: 'Dr. Dental',
    specialty: 'dental',
    consultation_fee: 500,
    follow_up_fee: 300,
    ...overrides,
  })
}
