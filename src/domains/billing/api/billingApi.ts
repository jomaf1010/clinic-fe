import { http } from '@/lib/http'
import type {
  BillingSummaryResponse,
  CreateInvoicePayload,
  InvoiceDetailResponse,
  InvoiceListResponse,
  RecordPaymentPayload,
  UpdateInvoicePayload,
  VoidInvoicePayload,
} from '../types/billing.types'

export const billingApi = {
  list(params?: { page?: number; per_page?: number; status?: string; search?: string }): Promise<InvoiceListResponse> {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.per_page) query.set('per_page', String(params.per_page))
    if (params?.status) query.set('status', params.status)
    if (params?.search) query.set('search', params.search)
    const qs = query.toString()
    return http.get<InvoiceListResponse>(`/invoices${qs ? `?${qs}` : ''}`)
  },

  get(id: string): Promise<InvoiceDetailResponse> {
    return http.get<InvoiceDetailResponse>(`/invoices/${id}`)
  },

  create(payload: CreateInvoicePayload): Promise<InvoiceDetailResponse> {
    return http.post<InvoiceDetailResponse>('/invoices', payload)
  },

  update(id: string, payload: UpdateInvoicePayload): Promise<InvoiceDetailResponse> {
    return http.patch<InvoiceDetailResponse>(`/invoices/${id}`, payload)
  },

  recordPayment(id: string, payload: RecordPaymentPayload): Promise<InvoiceDetailResponse> {
    return http.post<InvoiceDetailResponse>(`/invoices/${id}/payments`, payload)
  },

  void(id: string, payload: VoidInvoicePayload): Promise<InvoiceDetailResponse> {
    return http.patch<InvoiceDetailResponse>(`/invoices/${id}/void`, payload)
  },

  forConsultation(consultationId: string): Promise<InvoiceDetailResponse> {
    return http.get<InvoiceDetailResponse>(`/consultations/${consultationId}/invoice`)
  },

  summary(): Promise<BillingSummaryResponse> {
    return http.get<BillingSummaryResponse>('/billing/summary')
  },
}
