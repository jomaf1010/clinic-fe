export interface ClinicService {
  id: string
  clinic_id: string
  name: string
  description: string | null
  category: string | null
  specialties: string[]
  price: number | null
  usage_count: number
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface ServiceListResponse {
  data: ClinicService[]
  meta: {
    pagination: {
      page: number
      per_page: number
      total: number
      last_page: number
    }
  }
}

export interface SystemServiceResult {
  name: string
  description: string | null
  category: string
  specialties: string[]
  price_min: number | null
  price_max: number | null
}

export interface EncounterProcedure {
  service_id: string
  name: string
  quantity: number
  unit_price: number | null
  notes: string | null
}

export const SERVICE_CATEGORIES = [
  { value: 'screening', label: 'Screening' },
  { value: 'diagnostic', label: 'Diagnostic' },
  { value: 'therapeutic', label: 'Therapeutic' },
  { value: 'surgical', label: 'Surgical' },
  { value: 'preventive', label: 'Preventive' },
  { value: 'counseling', label: 'Counseling' },
  { value: 'general', label: 'General' },
] as const

export function serviceCategoryLabel(category: string): string {
  return SERVICE_CATEGORIES.find((c) => c.value === category)?.label ?? category
}
