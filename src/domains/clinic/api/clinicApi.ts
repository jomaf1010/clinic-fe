import { http } from '@/lib/http'
import type { ClinicResponse, CreateClinicPayload, CreateClinicResponse, UpdateClinicPayload } from '../types/clinic.types'

export const clinicApi = {
  create(payload: CreateClinicPayload): Promise<CreateClinicResponse> {
    return http.post<CreateClinicResponse>('/clinics', payload)
  },

  show(): Promise<{ data: ClinicResponse }> {
    return http.get<{ data: ClinicResponse }>('/clinic/profile')
  },

  update(payload: UpdateClinicPayload): Promise<{ data: ClinicResponse }> {
    return http.patch<{ data: ClinicResponse }>('/clinic/profile', payload)
  },

  uploadLogo(file: File): Promise<{ data: { logo_url: string } }> {
    const formData = new FormData()
    formData.append('logo', file)
    return http.upload<{ data: { logo_url: string } }>('/clinic/logo', formData)
  },
}
