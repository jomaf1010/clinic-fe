export interface CreateClinicPayload {
  clinic_name: string
  address?: string
  default_fee?: string
  rx_header?: string
  rx_footer?: string
}

export interface ClinicResponse {
  id: string
  clinic_name: string
  address: string | null
  default_fee: string | null
  rx_header: string | null
  rx_footer: string | null
  subscription: { plan: string }
}

export interface CreateClinicResponse {
  data: ClinicResponse
  meta: {
    access_token: string
    token_type: string
  }
}
