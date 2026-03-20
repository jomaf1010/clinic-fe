export interface ClinicConsumable {
  id: string
  clinic_id: string
  name: string
  description: string | null
  price: number | null
  stock_quantity: number
  usage_count: number
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface ConsumableListResponse {
  data: ClinicConsumable[]
  meta: {
    pagination: {
      page: number
      per_page: number
      total: number
      last_page: number
    }
  }
}

export interface CreateConsumablePayload {
  name: string
  description?: string | null
  price?: number | null
  stock_quantity?: number
}

export interface UpdateConsumablePayload {
  name?: string
  description?: string | null
  price?: number | null
  stock_quantity?: number
}

export interface AdjustStockPayload {
  adjustment: number
  reason: string
}
