export interface LoginCredentials {
  email: string
  password: string
  remember_me?: boolean
}

export interface SignupCredentials {
  email: string
  password: string
  name?: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface ValidationError {
  message: string
  errors: Record<string, string[]>
}

export interface Membership {
  id: string
  clinic_id: string
  clinic_name: string
  role: string
  status: string
}

export interface ClinicContext {
  id: string
  clinic_name: string
  role: string
  membership_id: string
  permissions: string[]
}

export interface User {
  id: string
  name: string | null
  email: string
  contact_number: string | null
  date_of_birth: string | null
  prc_license_number: string | null
  ptr_number: string | null
  s2_license_number: string | null
  specialty: string | null
  sub_specialty: string | null
  consultation_fee: number | null
  follow_up_fee: number | null
  emergency_fee: number | null
  avatar_url: string | null
  onboarding_completed: boolean
  current_clinic: ClinicContext | null
  theme: 'light' | 'dark' | null
}

export type LoginResponse = {
  data: TokenResponse
  meta: { memberships: Membership[] }
}

export type SignupResponse = {
  message: string
}

export interface VerifyEmailPayload {
  email: string
  token: string
}

export interface MessageResponse {
  message: string
}

export type SelectClinicResponse = {
  data: TokenResponse
}

export type MeResponse = {
  data: User
  meta: { memberships: Membership[] }
}

export interface RefreshResponse {
  data: TokenResponse
}
