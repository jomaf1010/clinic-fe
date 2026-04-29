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

export interface EncounterTimelineUpdatedEvent {
  type: 'encounter.timeline_updated'
  actor_id: string
  session_id?: string
  patient_id: string
  timestamp: string
  data: {
    encounter_id: string
    auto_display_line: string
    auto_display_summary: string | null
    updated_at: string
  }
}

export type PatientRealtimeEvent = PatientUpdatedEvent | PatientAvatarUpdatedEvent | EncounterTimelineUpdatedEvent
