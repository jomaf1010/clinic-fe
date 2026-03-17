export type PatientStatus = 'active' | 'inactive' | 'new' | 'returning'

export type PatientSortField = 'created_at' | 'updated_at' | 'full_name'
export type SortDirection = 'asc' | 'desc'

export interface PatientListFilters {
  status?: PatientStatus
  sex?: string
  search?: string
  sort_by?: PatientSortField
  sort_dir?: SortDirection
}

export interface CreatePatientPayload {
  full_name: string
  address: string
  date_of_birth: string
  sex: string
  contact_number?: string
  email?: string
  allergies?: string[]
  chronic_conditions?: string[]
  note?: string
}

export interface PatientResponse {
  id: string
  full_name: string
  address: string
  date_of_birth: string
  sex: string
  contact_number: string | null
  email: string | null
  allergies: string[]
  chronic_conditions: string[]
  note: string | null
  status: PatientStatus
  created_at: string
  updated_at: string
}

export interface CreatePatientResponse {
  data: PatientResponse
}

export interface PatientListResponse {
  data: PatientResponse[]
  meta: {
    pagination: {
      page: number
      per_page: number
      total: number
      last_page: number
    }
  }
}

export interface PatientDetailResponse {
  data: PatientResponse
}

export interface UpdatePatientPayload {
  full_name?: string
  address?: string
  date_of_birth?: string
  sex?: string
  contact_number?: string | null
  email?: string | null
  allergies?: string[]
  chronic_conditions?: string[]
  note?: string | null
}

export interface UpdatePatientResponse {
  data: PatientResponse
}

export interface SearchSuggestionsResponse {
  data: string[]
}

export interface PatientSearchResult {
  id: string
  full_name: string
  address: string
}

export interface PatientSearchResponse {
  data: PatientSearchResult[]
}
