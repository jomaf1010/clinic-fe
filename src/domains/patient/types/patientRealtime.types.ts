import type { PatientResponse } from './patient.types'

export interface PatientUpdatedEvent {
  type: 'patient.updated'
  actor_id: string
  session_id?: string
  patient_id: string
  timestamp: string
  data: PatientResponse
}

export interface PatientAvatarUpdatedEvent {
  type: 'patient.avatar_updated'
  actor_id: string
  session_id?: string
  patient_id: string
  timestamp: string
  data: { avatar_url: string }
}

export type PatientRealtimeEvent = PatientUpdatedEvent | PatientAvatarUpdatedEvent
