import { http } from '@/lib/http'
import type {
  CreatePatientPayload,
  CreatePatientResponse,
  PatientDetailResponse,
  PatientListFilters,
  PatientListResponse,
  PatientSearchResponse,
  SearchSuggestionsResponse,
  UpdatePatientPayload,
  UpdatePatientResponse,
} from '../types/patient.types'

export const patientApi = {
  create(payload: CreatePatientPayload): Promise<CreatePatientResponse> {
    return http.post<CreatePatientResponse>('/patients', payload)
  },

  list(page = 1, perPage = 15, filters?: PatientListFilters): Promise<PatientListResponse> {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
    if (filters?.status) params.set('status', filters.status)
    if (filters?.sex) params.set('sex', filters.sex)
    if (filters?.search) params.set('search', filters.search)
    if (filters?.sort_by) params.set('sort_by', filters.sort_by)
    if (filters?.sort_dir) params.set('sort_dir', filters.sort_dir)
    return http.get<PatientListResponse>(`/patients?${params.toString()}`)
  },

  get(uuid: string): Promise<PatientDetailResponse> {
    return http.get<PatientDetailResponse>(`/patients/${uuid}`)
  },

  update(uuid: string, payload: UpdatePatientPayload): Promise<UpdatePatientResponse> {
    return http.patch<UpdatePatientResponse>(`/patients/${uuid}`, payload)
  },

  searchAllergies(q: string): Promise<SearchSuggestionsResponse> {
    return http.get<SearchSuggestionsResponse>(`/allergies/search?q=${encodeURIComponent(q)}`)
  },

  searchConditions(q: string): Promise<SearchSuggestionsResponse> {
    return http.get<SearchSuggestionsResponse>(`/patient-conditions/search?q=${encodeURIComponent(q)}`)
  },

  search(q: string): Promise<PatientSearchResponse> {
    return http.get<PatientSearchResponse>(`/patients/search?q=${encodeURIComponent(q)}`)
  },
}
