export interface SystemMedicine {
  id: string
  name: string
  generic_name: string | null
  strength: string | null
  dosage_form: string | null
  manufacturer: string | null
  registration_number: string | null
}

export interface ClinicMedicine {
  id: string
  clinic_id: string
  system_medicine_id: string | null
  source: 'system' | 'custom'
  name: string
  generic_name: string | null
  strength: string | null
  dosage_form: string | null
  default_dose: string | null
  default_frequency: string | null
  default_route: string | null
  default_instructions: string | null
  default_price: number | null
  unit: string | null
  inventory_enabled: boolean
  stock_quantity: number
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface MedicineSearchResult {
  id: string
  name: string
  generic_name: string | null
  strength: string | null
  dosage_form: string | null
  default_dose: string | null
  default_frequency: string | null
  default_route: string | null
  default_instructions: string | null
  default_price: number | null
  source: 'clinic' | 'system'
}

export interface MedicineListResponse {
  data: ClinicMedicine[]
  meta: {
    pagination: {
      page: number
      per_page: number
      total: number
      last_page: number
    }
  }
}

export interface MedicineSearchResponse {
  data: MedicineSearchResult[]
}

export interface CreateMedicinePayload {
  name: string
  generic_name?: string | null
  strength?: string | null
  dosage_form?: string | null
  default_dose?: string | null
  default_frequency?: string | null
  default_route?: string | null
  default_instructions?: string | null
  default_price?: number | null
  unit?: string | null
  inventory_enabled?: boolean
  stock_quantity?: number
  system_medicine_id?: string | null
}

export interface UpdateMedicinePayload {
  name?: string
  generic_name?: string | null
  strength?: string | null
  dosage_form?: string | null
  default_dose?: string | null
  default_frequency?: string | null
  default_route?: string | null
  default_instructions?: string | null
  default_price?: number | null
  unit?: string | null
  inventory_enabled?: boolean
  stock_quantity?: number
}

export interface AdjustStockPayload {
  adjustment: number
  reason: string
}
