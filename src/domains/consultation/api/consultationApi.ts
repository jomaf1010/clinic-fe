import { http } from '@/lib/http'

export const consultationApi = {
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
