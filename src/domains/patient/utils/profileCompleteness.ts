import type { PatientResponse } from '../types/patient.types'

type ProfileCompletenessPatient = Pick<
  PatientResponse,
  'date_of_birth' | 'contact_number' | 'email' | 'formatted_address' | 'avatar_url' | 'note'
>

export function calculatePatientProfileCompleteness(
  patient: ProfileCompletenessPatient,
  avatarUrl: string | null = patient.avatar_url,
): number {
  const total = 6
  let filled = 0

  if (patient.date_of_birth) filled++
  if (patient.contact_number) filled++
  if (patient.email) filled++
  if (patient.formatted_address) filled++
  if (avatarUrl) filled++
  if (patient.note) filled++

  return filled / total
}
