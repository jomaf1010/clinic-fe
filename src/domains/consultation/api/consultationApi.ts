import { http } from '@/lib/http'

export const consultationApi = {
  searchDiagnoses(query: string): Promise<DiagnosisSearchResponse> {
    return http.get<DiagnosisSearchResponse>(`/diagnoses/search?q=${encodeURIComponent(query)}`)
  },

  requestMedCert(encounterId: string): Promise<{ data: { medcert_requested_by: string; medcert_requested_at: string } }> {
    return http.post<{ data: { medcert_requested_by: string; medcert_requested_at: string } }>(
      `/encounters/${encounterId}/request-medcert`,
      {},
    )
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
