import { describe, expect, it } from 'vitest'
import { buildAppointmentTriageRoute } from './triageRoute'

const PATIENT_ID = 'patient-1'

describe('buildAppointmentTriageRoute', () => {
  it('opens the checked-in appointment encounter when the backend returns one', () => {
    expect(buildAppointmentTriageRoute(PATIENT_ID, 'encounter-1')).toEqual({
      name: 'encounter-detail',
      params: {
        patientId: PATIENT_ID,
        id: 'encounter-1',
      },
    })
  })

  it('falls back to new encounter only when check-in did not return an encounter', () => {
    expect(buildAppointmentTriageRoute(PATIENT_ID, null)).toEqual({
      name: 'encounter-new',
      params: { patientId: PATIENT_ID },
    })
  })
})
