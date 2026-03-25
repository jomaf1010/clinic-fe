import type { PatientAddress } from '@/domains/patient/types/patient.types'

export interface LoginCredentials {
  email: string
  password: string
  remember_me?: boolean
}

export interface SignupCredentials {
  email: string
  password: string
  first_name?: string
  last_name?: string
  recaptcha_token: string
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
  logo_url: string | null
  role: string
  status: string
  plan: 'free' | 'pro'
  is_trial: boolean
}

export interface ClinicSettings {
  default_consultation_fee?: number | null
  default_follow_up_fee?: number | null
  auto_generate_prescription_pdf?: boolean
  prescription_quantity_mode?: 'absolute' | 'adjusted'
  auto_regenerate_pdf_on_qty_change?: boolean
}

export interface PlanLimit {
  max: number | null
  used: number
}

export interface ClinicContext {
  id: string
  clinic_name: string
  address: PatientAddress | null
  formatted_address: string | null
  contact_number: string | null
  email: string | null
  logo_url: string | null
  settings: ClinicSettings
  role: string
  membership_id: string
  permissions: string[]
  plan: 'free' | 'pro'
  is_trial: boolean
  trial_ends_at: string | null
  billing_period_ends_at: string | null
  cancel_at_period_end: boolean
  is_in_grace_period: boolean
  features: string[]
  limits: {
    team_members: PlanLimit
    pdf_generation_daily: PlanLimit
  }
}

export interface User {
  id: string
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  suffix: string | null
  name: string | null  // computed full name, kept for display
  title_prefix: string | null
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
