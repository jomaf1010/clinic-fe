/**
 * Tests for `calculatePatientProfileCompleteness`.
 *
 * Score is filled / 6 across {date_of_birth, contact_number, email,
 * formatted_address, avatar_url, note}. We verify the boundary cases
 * (all empty, all filled) plus the avatar-override semantic — the
 * caller can pass a separate avatar URL to use instead of the patient's
 * stored one (for the post-upload optimistic refresh).
 */

import { describe, expect, it } from 'vitest'
import { calculatePatientProfileCompleteness } from './profileCompleteness'
import type { PatientResponse } from '../types/patient.types'

type ProfileFields = Pick<
  PatientResponse,
  'date_of_birth' | 'contact_number' | 'email' | 'formatted_address' | 'avatar_url' | 'note'
>

function makeProfile(overrides: Partial<ProfileFields> = {}): ProfileFields {
  return {
    date_of_birth: null,
    contact_number: null,
    email: null,
    formatted_address: null,
    avatar_url: null,
    note: null,
    ...overrides,
  }
}

describe('calculatePatientProfileCompleteness', () => {
  it('returns 0 for an entirely empty profile', () => {
    expect(calculatePatientProfileCompleteness(makeProfile())).toBe(0)
  })

  it('returns 1 when all six fields are populated', () => {
    expect(
      calculatePatientProfileCompleteness(
        makeProfile({
          date_of_birth: '2000-01-01',
          contact_number: '09171234567',
          email: 'p@example.com',
          formatted_address: '1 Main St',
          avatar_url: 'https://x/y.png',
          note: 'note',
        }),
      ),
    ).toBe(1)
  })

  it('counts each field as 1/6', () => {
    const score = calculatePatientProfileCompleteness(
      makeProfile({ date_of_birth: '2020-01-01', email: 'a@b.co' }),
    )
    expect(score).toBeCloseTo(2 / 6, 5)
  })

  it('lets the explicit avatarUrl arg override the stored value', () => {
    // No stored avatar, but caller passes one → counted
    const score = calculatePatientProfileCompleteness(
      makeProfile({ avatar_url: null }),
      'https://upload.test/x.png',
    )
    expect(score).toBeCloseTo(1 / 6, 5)
  })

  it('lets the caller clear the avatar by passing null', () => {
    // Stored avatar, but caller passes null → not counted
    const score = calculatePatientProfileCompleteness(
      makeProfile({ avatar_url: 'https://stored/x.png' }),
      null,
    )
    expect(score).toBe(0)
  })

  it('treats empty strings as not-filled (falsy check)', () => {
    expect(
      calculatePatientProfileCompleteness(
        makeProfile({ email: '', note: '' }),
      ),
    ).toBe(0)
  })
})
