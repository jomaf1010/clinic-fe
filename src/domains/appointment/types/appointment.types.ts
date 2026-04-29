export type AppointmentStatus = 'scheduled' | 'cancelled' | 'checked_in' | 'completed' | 'no_show'

export interface AppointmentResponse {
  id: string
  clinic_id: string
  patient_id: string
  patient_name: string | null
  patient_avatar_url: string | null
  doctor_id: string
  doctor_name: string | null
  doctor_avatar_url: string | null
  created_by: string
  status: AppointmentStatus
  scheduled_at: string
  duration: number
  reason: string | null
  cancellation_reason: string | null
  cancelled_by: string | null
  checked_in_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateAppointmentPayload {
  patient_id: string
  doctor_id: string
  scheduled_at: string
  duration?: number | null // total minutes (multi-slot)
  reason?: string | null
  notes?: string | null
  consultation_type?: 'default' | 'follow_up'
}

export interface CancelAppointmentPayload {
  reason?: string | null
}

export interface AppointmentListFilters {
  doctor_id?: string
  patient_id?: string
  status?: AppointmentStatus
  date?: string
  start_date?: string
  end_date?: string
}

export interface AppointmentListResponse {
  data: AppointmentResponse[]
  meta: {
    pagination: {
      page: number
      per_page: number
      total: number
      last_page: number
    }
  }
}

export interface SingleAppointmentResponse {
  data: AppointmentResponse
}

export interface ClinicDoctor {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string | null
}

export interface ClinicDoctorsResponse {
  data: ClinicDoctor[]
}

export interface CheckInResponse {
  data: {
    appointment: AppointmentResponse
    queue_visit: {
      id: string
      position: number
      status: string
      [key: string]: unknown
    }
  }
}
