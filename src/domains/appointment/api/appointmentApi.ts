import { http } from '@/lib/http'
import type {
  AppointmentListFilters,
  AppointmentListResponse,
  CancelAppointmentPayload,
  CheckInResponse,
  ClinicDoctorsResponse,
  CreateAppointmentPayload,
  SingleAppointmentResponse,
} from '../types/appointment.types'

export const appointmentApi = {
  create(payload: CreateAppointmentPayload): Promise<SingleAppointmentResponse> {
    return http.post<SingleAppointmentResponse>('/appointments', payload)
  },

  list(page = 1, perPage = 15, filters?: AppointmentListFilters): Promise<AppointmentListResponse> {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
    if (filters?.doctor_id) params.set('doctor_id', filters.doctor_id)
    if (filters?.patient_id) params.set('patient_id', filters.patient_id)
    if (filters?.status) params.set('status', filters.status)
    if (filters?.date) params.set('date', filters.date)
    if (filters?.start_date) params.set('start_date', filters.start_date)
    if (filters?.end_date) params.set('end_date', filters.end_date)
    return http.get<AppointmentListResponse>(`/appointments?${params.toString()}`)
  },

  get(uuid: string): Promise<SingleAppointmentResponse> {
    return http.get<SingleAppointmentResponse>(`/appointments/${uuid}`)
  },

  cancel(uuid: string, payload?: CancelAppointmentPayload): Promise<SingleAppointmentResponse> {
    return http.patch<SingleAppointmentResponse>(`/appointments/${uuid}/cancel`, payload)
  },

  checkIn(uuid: string): Promise<CheckInResponse> {
    return http.post<CheckInResponse>(`/appointments/${uuid}/check-in`)
  },

  noShow(uuid: string): Promise<SingleAppointmentResponse> {
    return http.patch<SingleAppointmentResponse>(`/appointments/${uuid}/no-show`)
  },

  reschedule(uuid: string, scheduledAt: string): Promise<SingleAppointmentResponse> {
    return http.patch<SingleAppointmentResponse>(`/appointments/${uuid}/reschedule`, { scheduled_at: scheduledAt })
  },

  resize(uuid: string, duration: number): Promise<SingleAppointmentResponse> {
    return http.patch<SingleAppointmentResponse>(`/appointments/${uuid}/resize`, { duration })
  },

  getDoctors(): Promise<ClinicDoctorsResponse> {
    return http.get<ClinicDoctorsResponse>('/clinic/doctors')
  },
}
