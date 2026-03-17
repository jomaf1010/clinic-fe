import { http } from '@/lib/http'
import type {
  MedicineListResponse,
  MedicineSearchResponse,
  CreateMedicinePayload,
  UpdateMedicinePayload,
  AdjustStockPayload,
  ClinicMedicine,
  SystemMedicine,
} from '../types/medicine.types'

export const medicineApi = {
  list(page = 1, perPage = 20, q?: string, includeInactive?: boolean): Promise<MedicineListResponse> {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
    if (q) params.set('q', q)
    if (includeInactive) params.set('include_inactive', '1')
    return http.get<MedicineListResponse>(`/medicines?${params}`)
  },

  search(q: string): Promise<MedicineSearchResponse> {
    return http.get<MedicineSearchResponse>(`/medicines/search?q=${encodeURIComponent(q)}`)
  },

  searchSystem(q: string): Promise<{ data: (SystemMedicine & { source: 'system' })[] }> {
    return http.get<{ data: (SystemMedicine & { source: 'system' })[] }>(`/system/medicines?q=${encodeURIComponent(q)}`)
  },

  create(payload: CreateMedicinePayload): Promise<{ data: ClinicMedicine }> {
    return http.post<{ data: ClinicMedicine }>('/medicines', payload)
  },

  update(id: string, payload: UpdateMedicinePayload): Promise<{ data: ClinicMedicine }> {
    return http.patch<{ data: ClinicMedicine }>(`/medicines/${id}`, payload)
  },

  deactivate(id: string): Promise<{ data: ClinicMedicine }> {
    return http.delete<{ data: ClinicMedicine }>(`/medicines/${id}`)
  },

  adjustStock(id: string, payload: AdjustStockPayload): Promise<{ data: ClinicMedicine }> {
    return http.post<{ data: ClinicMedicine }>(`/medicines/${id}/adjust-stock`, payload)
  },
}
