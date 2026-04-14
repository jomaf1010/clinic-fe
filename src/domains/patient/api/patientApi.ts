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
import type { LifestyleData } from '@/domains/consultation/types/consultation.types'

export interface FamilyHistoryCondition {
  name: string
  icd_code: string | null
  age_of_onset: number | null
}

export interface FamilyHistoryEntry {
  uuid: string
  relative: string
  conditions: FamilyHistoryCondition[]
  alive: boolean
  age_at_death: number | null
  cause_of_death: string | null
  notes: string | null
}

export interface StoreFamilyHistoryPayload {
  relative: string
  conditions: FamilyHistoryCondition[]
  alive: boolean
  age_at_death?: number | null
  cause_of_death?: string | null
  notes?: string | null
}

export interface Medication {
  uuid: string
  drug_name: string
  dose: string | null
  frequency: string | null
  route: string | null
  indication: string | null
  started_date: string | null
  status: 'active' | 'discontinued' | 'on_hold'
  discontinue_reason: string | null
  notes: string | null
  updated_at: string
}

export interface PreventiveCareItem {
  key: string
  name: string
  category: string
  interval_years: number
  status: 'completed' | 'due' | 'overdue' | 'declined' | 'not_applicable'
  last_done_date: string | null
  next_due_date: string | null
  result: string | null
  notes: string | null
  recorded_uuid: string | null
}

export interface StorePreventiveCarePayload {
  screening_key: string
  status: 'completed' | 'declined' | 'not_applicable'
  last_done_date?: string | null
  result?: string | null
  notes?: string | null
}

export interface StoreMedicationPayload {
  drug_name: string
  dose?: string | null
  frequency?: string | null
  route?: string | null
  indication?: string | null
  started_date?: string | null
  status: 'active' | 'discontinued' | 'on_hold'
  discontinue_reason?: string | null
  notes?: string | null
}

export interface StructuredAllergy {
  uuid: string
  allergen: string
  type: 'drug' | 'food' | 'environmental' | 'other'
  severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis'
  reaction: string | null
  identified_date: string | null
  notes: string | null
}

export interface StoreAllergyPayload {
  allergen: string
  type: 'drug' | 'food' | 'environmental' | 'other'
  severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis'
  reaction?: string | null
  identified_date?: string | null
  notes?: string | null
}

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

  getLifestyle(uuid: string): Promise<{ data: LifestyleData }> {
    return http.get<{ data: LifestyleData }>(`/patients/${uuid}/lifestyle`)
  },

  updateLifestyle(uuid: string, payload: LifestyleData): Promise<{ data: LifestyleData }> {
    return http.put<{ data: LifestyleData }>(`/patients/${uuid}/lifestyle`, payload)
  },

  getFamilyHistory(patientId: string): Promise<{ data: FamilyHistoryEntry[] }> {
    return http.get<{ data: FamilyHistoryEntry[] }>(`/patients/${patientId}/family-history`)
  },

  addFamilyHistory(patientId: string, payload: StoreFamilyHistoryPayload): Promise<{ data: FamilyHistoryEntry }> {
    return http.post<{ data: FamilyHistoryEntry }>(`/patients/${patientId}/family-history`, payload)
  },

  updateFamilyHistory(patientId: string, entryUuid: string, payload: StoreFamilyHistoryPayload): Promise<{ data: FamilyHistoryEntry }> {
    return http.patch<{ data: FamilyHistoryEntry }>(`/patients/${patientId}/family-history/${entryUuid}`, payload)
  },

  deleteFamilyHistory(patientId: string, entryUuid: string): Promise<void> {
    return http.delete<void>(`/patients/${patientId}/family-history/${entryUuid}`)
  },

  getMedications(patientId: string, status?: string): Promise<{ data: Medication[] }> {
    const params = status ? `?status=${status}` : ''
    return http.get<{ data: Medication[] }>(`/patients/${patientId}/medications${params}`)
  },

  addMedication(patientId: string, payload: StoreMedicationPayload): Promise<{ data: Medication }> {
    return http.post<{ data: Medication }>(`/patients/${patientId}/medications`, payload)
  },

  updateMedication(patientId: string, entryUuid: string, payload: StoreMedicationPayload): Promise<{ data: Medication }> {
    return http.patch<{ data: Medication }>(`/patients/${patientId}/medications/${entryUuid}`, payload)
  },

  deleteMedication(patientId: string, entryUuid: string): Promise<void> {
    return http.delete<void>(`/patients/${patientId}/medications/${entryUuid}`)
  },

  getPreventiveCare(patientId: string): Promise<{ data: PreventiveCareItem[] }> {
    return http.get<{ data: PreventiveCareItem[] }>(`/patients/${patientId}/preventive-care`)
  },

  storePreventiveCare(patientId: string, payload: StorePreventiveCarePayload): Promise<{ data: PreventiveCareItem }> {
    return http.post<{ data: PreventiveCareItem }>(`/patients/${patientId}/preventive-care`, payload)
  },

  updatePreventiveCare(patientId: string, entryUuid: string, payload: StorePreventiveCarePayload): Promise<{ data: PreventiveCareItem }> {
    return http.patch<{ data: PreventiveCareItem }>(`/patients/${patientId}/preventive-care/${entryUuid}`, payload)
  },

  deletePreventiveCare(patientId: string, entryUuid: string): Promise<void> {
    return http.delete<void>(`/patients/${patientId}/preventive-care/${entryUuid}`)
  },

  getAllergies(patientId: string): Promise<{ data: StructuredAllergy[] }> {
    return http.get<{ data: StructuredAllergy[] }>(`/patients/${patientId}/allergies`)
  },

  addAllergy(patientId: string, payload: StoreAllergyPayload): Promise<{ data: StructuredAllergy }> {
    return http.post<{ data: StructuredAllergy }>(`/patients/${patientId}/allergies`, payload)
  },

  updateAllergy(patientId: string, allergyUuid: string, payload: StoreAllergyPayload): Promise<{ data: StructuredAllergy }> {
    return http.patch<{ data: StructuredAllergy }>(`/patients/${patientId}/allergies/${allergyUuid}`, payload)
  },

  deleteAllergy(patientId: string, allergyUuid: string): Promise<void> {
    return http.delete<void>(`/patients/${patientId}/allergies/${allergyUuid}`)
  },
}
