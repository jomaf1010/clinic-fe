export interface SystemMedicine {
  id: string
  generic_name: string | null
  brand_name: string | null
  display_name: string
  dosage_strength: string | null
  dosage_form: string | null
  classification: string | null
  pharmacologic_category: string | null
  manufacturer: string | null
  country_of_origin: string | null
  registration_number: string | null
}

export interface ClinicMedicine {
  id: string
  clinic_id: string
  system_medicine_id: string | null
  source: 'system' | 'custom'
  generic_name: string | null
  brand_name: string | null
  display_name: string
  dosage_strength: string | null
  dosage_form: string | null
  classification: string | null
  pharmacologic_category: string | null
  manufacturer: string | null
  country_of_origin: string | null
  registration_number: string | null
  default_frequency: string | null
  default_route: string | null
  default_instructions: string | null
  price_per_piece: number | null
  price_per_pack: number | null
  quantity_per_pack: number | null
  unit: string | null
  is_multi_dose: boolean
  inventory_enabled: boolean
  stock_quantity: number
  prescription_count: number
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface MedicineSearchResult {
  id: string
  generic_name: string | null
  brand_name: string | null
  display_name: string
  dosage_strength: string | null
  dosage_form: string | null
  default_frequency: string | null
  default_route: string | null
  default_instructions: string | null
  price_per_piece: number | null
  price_per_pack: number | null
  quantity_per_pack: number | null
  is_multi_dose: boolean
  inventory_enabled: boolean
  stock_quantity: number
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
  generic_name: string
  brand_name?: string | null
  dosage_strength?: string | null
  dosage_form?: string | null
  classification?: string | null
  pharmacologic_category?: string | null
  manufacturer?: string | null
  country_of_origin?: string | null
  registration_number?: string | null
  default_frequency?: string | null
  default_route?: string | null
  default_instructions?: string | null
  price_per_piece?: number | null
  price_per_pack?: number | null
  quantity_per_pack?: number | null
  unit?: string | null
  is_multi_dose?: boolean
  inventory_enabled?: boolean
  stock_quantity?: number
  system_medicine_id?: string | null
}

export interface UpdateMedicinePayload {
  generic_name?: string
  brand_name?: string | null
  dosage_strength?: string | null
  dosage_form?: string | null
  classification?: string | null
  pharmacologic_category?: string | null
  manufacturer?: string | null
  country_of_origin?: string | null
  registration_number?: string | null
  default_frequency?: string | null
  default_route?: string | null
  default_instructions?: string | null
  price_per_piece?: number | null
  price_per_pack?: number | null
  quantity_per_pack?: number | null
  unit?: string | null
  is_multi_dose?: boolean
  inventory_enabled?: boolean
  stock_quantity?: number
}

export interface AdjustStockPayload {
  adjustment: number
  reason: string
}
