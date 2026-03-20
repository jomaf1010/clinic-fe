import { http } from '@/lib/http'
import type { ClinicLabService, LabServiceListResponse } from '../types/labService.types'

export interface SystemLabItemResult {
  name: string
  category: string
}

export const labServiceApi = {
  list(page = 1, perPage = 20, q?: string): Promise<LabServiceListResponse> {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
    if (q) params.set('q', q)
    return http.get<LabServiceListResponse>(`/lab-services?${params}`)
  },

  create(payload: { name: string; category?: string | null; price?: number | null }): Promise<{ data: ClinicLabService }> {
    return http.post<{ data: ClinicLabService }>('/lab-services', payload)
  },

  update(id: string, payload: { name?: string; category?: string | null; price?: number | null }): Promise<{ data: ClinicLabService }> {
    return http.patch<{ data: ClinicLabService }>(`/lab-services/${id}`, payload)
  },

  deactivate(id: string): Promise<{ data: ClinicLabService }> {
    return http.delete<{ data: ClinicLabService }>(`/lab-services/${id}`)
  },

  findOrCreate(payload: { name: string; category?: string }): Promise<{ data: ClinicLabService }> {
    return http.post<{ data: ClinicLabService }>('/lab-services/find-or-create', payload)
  },

  searchSystem(q: string): Promise<{ data: SystemLabItemResult[] }> {
    return http.get<{ data: SystemLabItemResult[] }>(`/system/lab-items?q=${encodeURIComponent(q)}`)
  },
}
