export interface CreateClinicPayload {
  clinic_name: string
  address?: string
  email?: string
}

export interface ClinicResponse {
  id: string
  clinic_name: string
  address: string | null
  contact_number: string | null
  email: string | null
  logo_url: string | null
  default_fee: string | null
  settings: Record<string, unknown>
  subscription: { plan: string }
}

export interface CreateClinicResponse {
  data: ClinicResponse
  meta: {
    access_token: string
    token_type: string
  }
}

export interface UpdateClinicPayload {
  clinic_name?: string
  address?: string | null
  contact_number?: string | null
  email?: string | null
  default_fee?: number | null
  settings?: {
    auto_generate_prescription_pdf?: boolean
    prescription_quantity_mode?: 'absolute' | 'adjusted'
    auto_regenerate_pdf_on_qty_change?: boolean
  }
}
