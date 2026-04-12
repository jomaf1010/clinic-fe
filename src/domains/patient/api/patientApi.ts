import { http } from '@/lib/http'
import type {
  ChronicTrendsResponse,
  CreatePatientPayload,
  CreatePatientResponse,
  CreateProblemPayload,
  PatientDetailResponse,
  PatientListFilters,
  PatientListResponse,
  PatientSearchResponse,
  Problem,
  SearchSuggestionsResponse,
  UpdatePatientPayload,
  UpdatePatientResponse,
  UpdateProblemPayload,
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

  uploadAvatar(uuid: string, file: File): Promise<{ data: { avatar_url: string } }> {
    const formData = new FormData()
    formData.append('avatar', file)
    return http.upload(`/patients/${uuid}/avatar`, formData)
  },

  getProblems(uuid: string): Promise<{ data: Problem[] }> {
    return http.get<{ data: Problem[] }>(`/patients/${uuid}/problems`)
  },

  addProblem(uuid: string, payload: CreateProblemPayload): Promise<{ data: Problem }> {
    return http.post<{ data: Problem }>(`/patients/${uuid}/problems`, payload)
  },

  updateProblem(uuid: string, payload: UpdateProblemPayload): Promise<{ data: Problem }> {
    return http.patch<{ data: Problem }>(`/problems/${uuid}`, payload)
  },

  deleteProblem(uuid: string): Promise<void> {
    return http.delete<void>(`/problems/${uuid}`)
  },

  getChronicTrends(uuid: string): Promise<ChronicTrendsResponse> {
    return http.get<ChronicTrendsResponse>(`/patients/${uuid}/chronic-trends`)
  },
}
