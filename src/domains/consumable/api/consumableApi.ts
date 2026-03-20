import { http } from '@/lib/http'
import type {
  ConsumableListResponse,
  CreateConsumablePayload,
  UpdateConsumablePayload,
  AdjustStockPayload,
  ClinicConsumable,
} from '../types/consumable.types'

export const consumableApi = {
  list(page = 1, perPage = 20, q?: string): Promise<ConsumableListResponse> {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
    if (q) params.set('q', q)
    return http.get<ConsumableListResponse>(`/consumables?${params}`)
  },

  create(payload: CreateConsumablePayload): Promise<{ data: ClinicConsumable }> {
    return http.post<{ data: ClinicConsumable }>('/consumables', payload)
  },

  update(id: string, payload: UpdateConsumablePayload): Promise<{ data: ClinicConsumable }> {
    return http.patch<{ data: ClinicConsumable }>(`/consumables/${id}`, payload)
  },

  deactivate(id: string): Promise<{ data: ClinicConsumable }> {
    return http.delete<{ data: ClinicConsumable }>(`/consumables/${id}`)
  },

  adjustStock(id: string, payload: AdjustStockPayload): Promise<{ data: ClinicConsumable }> {
    return http.post<{ data: ClinicConsumable }>(`/consumables/${id}/adjust-stock`, payload)
  },
}
