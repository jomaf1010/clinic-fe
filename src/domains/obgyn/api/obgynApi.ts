import { http } from '@/lib/http'
import type { GynProfile, Pregnancy, PregnancyOutcome, PrenatalVisit, LabsDueItem, PregnancyDashboard, ChecklistItem, DueReminders } from '../types/obgyn.types'

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
  previous_pregnancies?: Array<{ year: number | null; outcome: string | null; delivery_type: string | null; complications: string | null; sex: string | null; birth_weight: number | null; notes: string | null }> | null
  screenings?: Array<{ date: string; type: string; result?: string | null; notes?: string | null }> | null
  contraception?: Array<{ method: string[]; start_date: string; end_date?: string | null; notes?: string | null }> | null
}

export interface CreatePregnancyPayload {
  lmp?: string | null
  edd?: string | null
  edd_source?: 'lmp' | 'ultrasound' | 'adjusted' | null
  first_ultrasound_date?: string | null
  first_ultrasound_ga?: string | null
  fetus_count?: number
  fetuses?: { label: string; sex: 'male' | 'female' | 'unknown' }[]
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
  fetal_movement?: 'present' | 'decreased' | 'absent'
  danger_signs?: string[]
  systolic_bp?: number | null
  diastolic_bp?: number | null
  heart_rate?: number | null
  respiratory_rate?: number | null
  temperature?: number | null
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

  evaluateRisk(patientId: string, payload: Record<string, unknown>): Promise<{ data: { level: string; factors: string[] } }> {
    return http.post<{ data: { level: string; factors: string[] } }>(`/patients/${patientId}/pregnancy-risk-evaluate`, payload)
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

  // Prenatal Care Checklist
  getChecklist(patientId: string, pregnancyId: string): Promise<{ data: ChecklistItem[] }> {
    return http.get<{ data: ChecklistItem[] }>(`/patients/${patientId}/pregnancies/${pregnancyId}/labs-due`)
  },

  toggleChecklistItem(
    patientId: string,
    pregnancyId: string,
    payload: { key: string; completed: boolean; notes?: string | null },
  ): Promise<{ data: ChecklistItem[] }> {
    return http.post<{ data: ChecklistItem[] }>(
      `/patients/${patientId}/pregnancies/${pregnancyId}/checklist`,
      payload,
    )
  },

  getReminders(patientId: string, pregnancyId: string): Promise<{ data: DueReminders }> {
    return http.get<{ data: DueReminders }>(`/patients/${patientId}/pregnancies/${pregnancyId}/reminders`)
  },

  // Resolve Pregnancy
  resolvePregnancy(
    patientId: string,
    pregnancyId: string,
    payload: {
      outcome: PregnancyOutcome
      outcome_date: string
      management?: string | null
      ectopic_location?: string | null
      ectopic_confirmation?: string | null
      hcg_surveillance?: boolean | null
      notes?: string | null
    },
  ): Promise<{ data: Pregnancy; encounter_id: string | null }> {
    return http.post<{ data: Pregnancy; encounter_id: string | null }>(
      `/patients/${patientId}/pregnancies/${pregnancyId}/resolve`,
      payload,
    )
  },
}
