export interface ClinicLabService {
  id: string
  clinic_id: string
  name: string
  category: string | null
  price: number | null
  usage_count: number
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface LabServiceListResponse {
  data: ClinicLabService[]
  meta: {
    pagination: {
      page: number
      per_page: number
      total: number
      last_page: number
    }
  }
}
