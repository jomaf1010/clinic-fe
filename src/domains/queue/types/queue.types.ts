export type QueueVisitStatus = 'waiting' | 'in_progress' | 'completed' | 'cancelled'
export type QueueVisitType = 'appointment' | 'walk_in'

export interface QueueVisitResponse {
  id: string
  clinic_id: string
  patient_id: string
  patient_name: string | null
  patient_sex: string | null
  patient_avatar_url: string | null
  doctor_id: string | null
  doctor_name: string | null
  appointment_id: string | null
  consultation_id: string | null
  status: QueueVisitStatus
  type: QueueVisitType
  priority: number
  position: number
  reason: string | null
  checked_in_at: string
  called_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateWalkInPayload {
  patient_id: string
  doctor_id?: string | null
  reason?: string | null
  notes?: string | null
}

export interface QueueListResponse {
  data: QueueVisitResponse[]
}

export interface SingleQueueVisitResponse {
  data: QueueVisitResponse
}

export interface QueueDisplayData {
  clinic_name: string
  visits: QueueVisitResponse[]
  centrifugo: {
    connection_token: string
    subscription_token: string
    channel: string
  }
}

export interface QueueDisplayCentrifugoTokens {
  connection_token: string
  subscription_token: string
}

export interface QueueDisplayTokenStatus {
  token: string | null
  created_at: string | null
}
