import { http } from '@/lib/http'
import type { CreateClinicPayload, CreateClinicResponse } from '../types/clinic.types'

export const clinicApi = {
  create(payload: CreateClinicPayload): Promise<CreateClinicResponse> {
    return http.post<CreateClinicResponse>('/clinics', payload)
  },
}
