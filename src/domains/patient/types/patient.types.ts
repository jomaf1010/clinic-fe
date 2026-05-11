export type PatientStatus = 'active' | 'inactive' | 'new' | 'returning'

export interface PatientName {
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
}

export interface PatientAddress {
  region_code: string
  region_name: string
  province_code: string
  province_name: string
  city_code: string
  city_name: string
  barangay_code: string
  barangay_name: string
  street: string | null
}

export type PatientSortField = 'created_at' | 'updated_at' | 'full_name' | 'last_name'
export type SortDirection = 'asc' | 'desc'

export interface PatientListFilters {
  status?: PatientStatus
  sex?: string
  search?: string
  sort_by?: PatientSortField
  sort_dir?: SortDirection
}

export interface CreatePatientPayload {
  first_name: string
  middle_name?: string | null
  last_name: string
  suffix?: string | null
  address: PatientAddress
  date_of_birth: string
  sex: string
  blood_type?: string | null
  contact_number?: string
  email?: string
  note?: string
}

export interface PatientResponse {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  formal_name: string
  full_name: string
  address: PatientAddress | null
  formatted_address: string
  date_of_birth: string
  sex: string
  blood_type: string | null
  contact_number: string | null
  email: string | null
  note: string | null
  avatar_url: string | null
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

export type PatientAttentionType = 'pending_lab_order_today' | 'draft_encounter'
export type PatientAttentionCategory = 'clinical' | 'documentation'
export type PatientAttentionPriority = 'low' | 'medium' | 'high'

export interface PatientAttentionPatient {
  id: string
  full_name: string
  sex: string
  date_of_birth: string | null
  avatar_url: string | null
}

export interface PatientAttentionItem {
  id: string
  type: PatientAttentionType
  category: PatientAttentionCategory
  priority: PatientAttentionPriority
  title: string
  description: string
  patient: PatientAttentionPatient
  occurred_at: string | null
  encounter_id: string | null
  lab_order_id: string | null
  meta: {
    encounter_status?: string
    encounter_type?: string
    specialty?: string
    pending_count?: number
    total_count?: number
  }
}

export interface PatientAttentionSummary {
  date: string
  timezone: string
  counts: {
    total: number
    pending_lab_orders_today: number
    draft_encounters: number
  }
  items: PatientAttentionItem[]
}

export interface PatientAttentionSummaryResponse {
  data: PatientAttentionSummary
}

export interface PatientDetailResponse {
  data: PatientResponse
}

export interface UpdatePatientPayload {
  first_name?: string
  middle_name?: string | null
  last_name?: string
  suffix?: string | null
  address?: PatientAddress
  date_of_birth?: string
  sex?: string
  blood_type?: string | null
  contact_number?: string | null
  email?: string | null
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

export type ProblemStatus = 'active' | 'controlled' | 'uncontrolled' | 'resolved'

export interface Problem {
  uuid: string
  description: string
  icd_code: string | null
  status: ProblemStatus
  onset_date: string | null
  created_at: string
  updated_at: string
}

export interface CreateProblemPayload {
  description: string
  icd_code?: string | null
  status?: ProblemStatus
  onset_date?: string | null
}

export interface UpdateProblemPayload {
  description?: string
  icd_code?: string | null
  status?: ProblemStatus
  onset_date?: string | null
}

export interface ChronicTrendPoint {
  date: string
  value?: number
  systolic?: number
  diastolic?: number
  classification?: string | null
}

export interface ChronicTrendsData {
  bp?: ChronicTrendPoint[]
  blood_sugar?: ChronicTrendPoint[]
  weight?: ChronicTrendPoint[]
  bmi?: ChronicTrendPoint[]
}

export interface ChronicTrendsResponse {
  data: ChronicTrendsData
}
