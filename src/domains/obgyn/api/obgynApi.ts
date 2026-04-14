import { http } from '@/lib/http'
import type { GynProfile, Pregnancy, PrenatalVisit, LabsDueItem, PregnancyDashboard } from '../types/obgyn.types'

export interface UpsertGynProfilePayload {
  menarche_age?: number | null
  cycle_length?: number | null
  regularity?: 'regular' | 'irregular' | null
  duration?: number | null
  flow?: 'light' | 'moderate' | 'heavy' | null
  dysmenorrhea?: 'none' | 'mild' | 'moderate' | 'severe' | null
  gravidity?: number | null
  parity_term?: number | null
  parity_preterm?: number | null
  abortions?: number | null
  living_children?: number | null
  last_pap_date?: string | null
  last_pap_result?: string | null
  hpv_status?: string | null
  screening_interval?: string | null
  current_contraception?: { method: string; started_date?: string | null } | null
}

export interface CreatePregnancyPayload {
  lmp?: string | null
  edd?: string | null
  edd_source?: 'lmp' | 'ultrasound' | 'adjusted' | null
  first_ultrasound_date?: string | null
  first_ultrasound_ga?: string | null
  gravidity?: number | null
  parity_term?: number | null
  parity_preterm?: number | null
  abortions?: number | null
  living_children?: number | null
  pre_pregnancy_weight?: number | null
  height?: number | null
  medical_conditions?: string | null
  surgical_history?: string | null
  blood_type_rh?: string | null
  smoking?: string | null
  alcohol?: string | null
  ipv_screened?: boolean
  risk_level?: string | null
  risk_factors?: string[]
}

export interface CreateVisitPayload {
  visit_date: string
  gestational_age_weeks?: number | null
  gestational_age_days?: number | null
  concerns?: string | null
  fetal_movement?: string | null
  danger_signs?: string[]
  bp_systolic?: number | null
  bp_diastolic?: number | null
  weight?: number | null
  fundal_height?: number | null
  fetal_heart_rate?: number | null
  fetal_presentation?: string | null
  next_visit_date?: string | null
  complications?: string[]
  pregnancy_progress?: string | null
  risk_level_update?: string | null
}

export const obgynApi = {
  // GYN Profile
  getGynProfile(patientId: string): Promise<{ data: GynProfile }> {
    return http.get<{ data: GynProfile }>(`/patients/${patientId}/gyn-profile`)
  },

  upsertGynProfile(patientId: string, payload: UpsertGynProfilePayload): Promise<{ data: GynProfile }> {
    return http.put<{ data: GynProfile }>(`/patients/${patientId}/gyn-profile`, payload)
  },

  // Pregnancies
  listPregnancies(patientId: string): Promise<{ data: Pregnancy[] }> {
    return http.get<{ data: Pregnancy[] }>(`/patients/${patientId}/pregnancies`)
  },

  createPregnancy(patientId: string, payload: CreatePregnancyPayload): Promise<{ data: Pregnancy }> {
    return http.post<{ data: Pregnancy }>(`/patients/${patientId}/pregnancies`, payload)
  },

  getPregnancy(patientId: string, pregnancyId: string): Promise<{ data: Pregnancy }> {
    return http.get<{ data: Pregnancy }>(`/patients/${patientId}/pregnancies/${pregnancyId}`)
  },

  updatePregnancy(patientId: string, pregnancyId: string, payload: Partial<CreatePregnancyPayload>): Promise<{ data: Pregnancy }> {
    return http.patch<{ data: Pregnancy }>(`/patients/${patientId}/pregnancies/${pregnancyId}`, payload)
  },

  deletePregnancy(patientId: string, pregnancyId: string): Promise<void> {
    return http.delete<void>(`/patients/${patientId}/pregnancies/${pregnancyId}`)
  },

  getDashboard(patientId: string, pregnancyId: string): Promise<{ data: PregnancyDashboard }> {
    return http.get<{ data: PregnancyDashboard }>(`/patients/${patientId}/pregnancies/${pregnancyId}/dashboard`)
  },

  getLabsDue(patientId: string, pregnancyId: string): Promise<{ data: LabsDueItem[] }> {
    return http.get<{ data: LabsDueItem[] }>(`/patients/${patientId}/pregnancies/${pregnancyId}/labs-due`)
  },

  // Prenatal Visits
  listVisits(patientId: string, pregnancyId: string): Promise<{ data: PrenatalVisit[] }> {
    return http.get<{ data: PrenatalVisit[] }>(`/patients/${patientId}/pregnancies/${pregnancyId}/visits`)
  },

  createVisit(patientId: string, pregnancyId: string, payload: CreateVisitPayload): Promise<{ data: PrenatalVisit }> {
    return http.post<{ data: PrenatalVisit }>(`/patients/${patientId}/pregnancies/${pregnancyId}/visits`, payload)
  },

  updateVisit(patientId: string, pregnancyId: string, visitId: string, payload: Partial<CreateVisitPayload>): Promise<{ data: PrenatalVisit }> {
    return http.patch<{ data: PrenatalVisit }>(`/patients/${patientId}/pregnancies/${pregnancyId}/visits/${visitId}`, payload)
  },

  deleteVisit(patientId: string, pregnancyId: string, visitId: string): Promise<void> {
    return http.delete<void>(`/patients/${patientId}/pregnancies/${pregnancyId}/visits/${visitId}`)
  },
}
