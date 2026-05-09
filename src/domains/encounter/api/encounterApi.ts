import { http } from '@/lib/http'
import type {
  CreateEncounterPayload,
  CreateEncounterResponse,
  EncounterDetailResponse,
  EncounterListResponse,
  FinalizeEncounterResponse,
  SoapDraftApiResponse,
  UpdateEncounterPayload,
  UpdateEncounterResponse,
} from '../types/encounter.types'
import type { ConsultationConsumable } from '@/domains/consultation/types/consultation.types'

export const encounterApi = {
  create(patientId: string, payload: CreateEncounterPayload): Promise<CreateEncounterResponse> {
    return http.post<CreateEncounterResponse>(`/patients/${patientId}/encounters`, payload)
  },

  list(patientId: string, page = 1, perPage = 10, filters?: { month?: number; year?: number; pregnancy_id?: string }): Promise<EncounterListResponse> {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
    if (filters?.month) params.set('month', String(filters.month))
    if (filters?.year) params.set('year', String(filters.year))
    if (filters?.pregnancy_id) params.set('pregnancy_id', filters.pregnancy_id)
    return http.get<EncounterListResponse>(`/patients/${patientId}/encounters?${params}`)
  },

  get(id: string): Promise<EncounterDetailResponse> {
    return http.get<EncounterDetailResponse>(`/encounters/${id}`)
  },

  update(id: string, payload: UpdateEncounterPayload, expectedUpdatedAt?: string): Promise<UpdateEncounterResponse> {
    if (expectedUpdatedAt) {
      return http.patch<UpdateEncounterResponse>(`/encounters/${id}`, payload, { 'X-Expected-Updated-At': expectedUpdatedAt })
    }
    return http.patch<UpdateEncounterResponse>(`/encounters/${id}`, payload)
  },

  finalize(id: string): Promise<FinalizeEncounterResponse> {
    return http.post<FinalizeEncounterResponse>(`/encounters/${id}/finalize`)
  },

  generateSoapDraft(id: string): Promise<SoapDraftApiResponse> {
    return http.post<SoapDraftApiResponse>(`/encounters/${id}/soap-draft`)
  },

  delete(id: string): Promise<void> {
    return http.delete<void>(`/encounters/${id}`)
  },

  saveConsumables(id: string, consumables: ConsultationConsumable[]): Promise<EncounterDetailResponse> {
    return http.put<EncounterDetailResponse>(`/encounters/${id}/consumables`, { consumables })
  },

  saveFeeDiscount(
    id: string,
    payload: { fee_discount_type: string | null; fee_discount_value: number | null },
  ): Promise<EncounterDetailResponse> {
    return http.put<EncounterDetailResponse>(`/encounters/${id}/fee-discount`, payload)
  },

  requestMedCert(id: string): Promise<EncounterDetailResponse> {
    return http.post<EncounterDetailResponse>(`/encounters/${id}/request-medcert`)
  },

  searchDiagnoses(query: string): Promise<DiagnosisSearchResponse> {
    return http.get<DiagnosisSearchResponse>(`/diagnoses/search?q=${encodeURIComponent(query)}`)
  },
}

export interface DiagnosisSearchResult {
  id: string
  code: string | null
  description: string
  source: 'icd' | 'manual'
}

export interface DiagnosisSearchResponse {
  data: DiagnosisSearchResult[]
}
