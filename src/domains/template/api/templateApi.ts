import { http } from '@/lib/http'
import type { PrescriptionTemplate } from '../types/template.types'

export interface ClinicTemplateResponse {
  id: string
  category: string
  variation: string
  name: string
  config: PrescriptionTemplate
  is_active: boolean
}

export const templateApi = {
  list(): Promise<{ data: ClinicTemplateResponse[] }> {
    return http.get<{ data: ClinicTemplateResponse[] }>('/clinic/templates')
  },

  show(category: string, variation: string): Promise<{ data: ClinicTemplateResponse | null }> {
    return http.get<{ data: ClinicTemplateResponse | null }>(`/clinic/templates/${category}/${variation}`)
  },

  upsert(category: string, variation: string, payload: { name: string; config: PrescriptionTemplate; is_active?: boolean }): Promise<{ data: ClinicTemplateResponse }> {
    return http.put<{ data: ClinicTemplateResponse }>(`/clinic/templates/${category}/${variation}`, payload)
  },
}
