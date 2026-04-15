import { http } from '@/lib/http'
import type { ClinicService, ServiceListResponse, SystemServiceResult, EncounterProcedure } from '../types/service.types'

export const serviceApi = {
  list(page = 1, perPage = 20, filters?: { q?: string; category?: string; specialty?: string }): Promise<ServiceListResponse> {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
    if (filters?.q) params.set('q', filters.q)
    if (filters?.category) params.set('category', filters.category)
    if (filters?.specialty) params.set('specialty', filters.specialty)
    return http.get<ServiceListResponse>(`/clinic-services?${params}`)
  },

  create(payload: {
    name: string
    description?: string | null
    category: string
    specialties: string[]
    price?: number | null
  }): Promise<{ data: ClinicService }> {
    return http.post<{ data: ClinicService }>('/clinic-services', payload)
  },

  update(id: string, payload: {
    name?: string
    description?: string | null
    category?: string
    specialties?: string[]
    price?: number | null
  }): Promise<{ data: ClinicService }> {
    return http.patch<{ data: ClinicService }>(`/clinic-services/${id}`, payload)
  },

  deactivate(id: string): Promise<{ data: ClinicService }> {
    return http.delete<{ data: ClinicService }>(`/clinic-services/${id}`)
  },

  searchSystem(q: string, specialty?: string): Promise<{ data: SystemServiceResult[] }> {
    const params = new URLSearchParams({ q })
    if (specialty) params.set('specialty', specialty)
    return http.get<{ data: SystemServiceResult[] }>(`/system-services/search?${params}`)
  },

  // Encounter procedures
  saveProcedures(encounterId: string, procedures: EncounterProcedure[]): Promise<{ data: unknown }> {
    return http.put(`/encounters/${encounterId}/procedures`, { procedures })
  },
}
