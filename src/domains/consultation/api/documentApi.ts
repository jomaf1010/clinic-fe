import { http } from '@/lib/http'

export interface GeneratedDocumentResponse {
  id: string
  type: string
  status: 'pending' | 'generating' | 'completed' | 'failed'
  download_url: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export const documentApi = {
  generate(consultationId: string, type: string, meta?: Record<string, unknown>): Promise<{ data: GeneratedDocumentResponse }> {
    return http.post<{ data: GeneratedDocumentResponse }>(`/consultations/${consultationId}/documents`, { type, ...(meta ? { meta } : {}) })
  },

  list(consultationId: string): Promise<{ data: GeneratedDocumentResponse[] }> {
    return http.get<{ data: GeneratedDocumentResponse[] }>(`/consultations/${consultationId}/documents`)
  },

  async getSignedUrl(documentId: string): Promise<string> {
    const res = await http.get<{ data: { url: string } }>(`/documents/${documentId}/signed-url`)
    return res.data.url
  },
}
