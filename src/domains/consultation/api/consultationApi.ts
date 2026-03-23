import { http } from '@/lib/http'
import type {
  ConsultationDetailResponse,
  ConsultationListResponse,
  CreateConsultationPayload,
  CreateConsultationResponse,
  FinalizeConsultationResponse,
  UpdateConsultationPayload,
  UpdateConsultationResponse,
} from '../types/consultation.types'

export const consultationApi = {
  create(patientId: string, payload: CreateConsultationPayload): Promise<CreateConsultationResponse> {
    return http.post<CreateConsultationResponse>(`/patients/${patientId}/consultations`, payload)
  },

  list(patientId: string, page = 1, perPage = 10, filters?: { month?: number; year?: number }): Promise<ConsultationListResponse> {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
    if (filters?.month) params.set('month', String(filters.month))
    if (filters?.year) params.set('year', String(filters.year))
    return http.get<ConsultationListResponse>(`/patients/${patientId}/consultations?${params}`)
  },

  get(id: string): Promise<ConsultationDetailResponse> {
    return http.get<ConsultationDetailResponse>(`/consultations/${id}`)
  },

  update(id: string, payload: UpdateConsultationPayload): Promise<UpdateConsultationResponse> {
    return http.patch<UpdateConsultationResponse>(`/consultations/${id}`, payload)
  },

  finalize(id: string): Promise<FinalizeConsultationResponse> {
    return http.post<FinalizeConsultationResponse>(`/consultations/${id}/finalize`)
  },

  saveConsumables(
    id: string,
    consumables: { consumable_id: string; name: string; quantity: number; unit_price: number | null }[],
  ): Promise<ConsultationDetailResponse> {
    return http.put<ConsultationDetailResponse>(`/consultations/${id}/consumables`, { consumables })
  },

  saveFeeDiscount(
    id: string,
    payload: { fee_discount_type: string | null; fee_discount_value: number | null },
  ): Promise<ConsultationDetailResponse> {
    return http.put<ConsultationDetailResponse>(`/consultations/${id}/fee-discount`, payload)
  },

  requestMedCert(id: string): Promise<ConsultationDetailResponse> {
    return http.post<ConsultationDetailResponse>(`/consultations/${id}/request-medcert`)
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
