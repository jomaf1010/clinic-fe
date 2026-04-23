import { http } from '@/lib/http'

// ── Birth History ─────────────────────────────────────────────────────────────

export interface BirthHistoryFields {
  gestational_age_weeks: number | null
  birth_weight_grams: number | null
  birth_length_cm: number | null
  delivery_type: 'vaginal' | 'cesarean' | 'forceps' | 'vacuum' | null
  apgar_1min: number | null
  apgar_5min: number | null
  nicu_stay: boolean | null
  nicu_duration_days: number | null
  newborn_screening: boolean | null
  newborn_screening_result: 'normal' | 'abnormal' | 'pending' | null
  newborn_complications: string | null
}

export interface FeedingHistoryFields {
  feeding_type: 'breastfed' | 'formula' | 'mixed' | null
  breastfeeding_duration_months: number | null
  formula_brand: string | null
  complementary_food_started_months: number | null
  food_allergies: string | null
  notes: string | null
}

export interface BirthHistoryResponse {
  data: {
    birth_history: Partial<BirthHistoryFields>
    feeding_history: Partial<FeedingHistoryFields>
  }
}

// ── Immunizations ─────────────────────────────────────────────────────────────

export interface ImmunizationDoseRecord {
  dose: number
  label: string
  recommended_date: string
  status: 'given' | 'due' | 'overdue'
  date_given: string | null
  batch_number: string | null
  site: string | null
  recorded_uuid: string | null
}

export interface ImmunizationVaccineGroup {
  key: string
  name: string
  description: string
  doses: number
  schedule: ImmunizationDoseRecord[]
}

export interface RecurringDoseGiven {
  uuid: string
  date_given: string
  batch_number: string | null
  site: string | null
  notes: string | null
}

export interface RecurringVaccineEntry {
  key: string
  name: string
  description: string | null
  eligible_from_weeks: number
  recurrence_months: number
  first_time_note: string | null
  doses_given: RecurringDoseGiven[]
  next_due: string | null
  is_overdue: boolean
}

export interface AdhocVaccineRecord {
  uuid: string
  vaccine_key: string
  vaccine_name: string
  dose_number: number
  date_given: string
  batch_number: string | null
  site: string | null
  notes: string | null
}

export interface ImmunizationTieredResponse {
  epi: ImmunizationVaccineGroup[]
  recommended: ImmunizationVaccineGroup[]
  recurring: RecurringVaccineEntry[]
  adhoc: AdhocVaccineRecord[]
}

export interface RecordDosePayload {
  tier?: 'epi' | 'recommended' | 'recurring' | 'adhoc'
  vaccine_key: string
  vaccine_name?: string | null
  dose_number?: number
  date_given: string
  batch_number?: string | null
  site?: string | null
  notes?: string | null
}

// ── Growth History ─────────────────────────────────────────────────────────────

export interface GrowthMeasurement {
  date: string
  age_months: number | null
  weight_kg?: number
  weight_percentile?: number | null
  height_cm?: number
  height_percentile?: number | null
  head_circumference_cm?: number
  hc_percentile?: number | null
  bmi?: number
}

// ── Developmental Milestones ─────────────────────────────────────────────────

export interface MilestoneItem {
  key: string
  domain: 'gross_motor' | 'fine_motor' | 'language' | 'social'
  label: string
  result: 'pass' | 'concern' | 'not_assessed'
}

export interface MilestoneRedFlag {
  key: string
  label: string
  prompt: string
}

export interface MilestoneCheckpoint {
  checkpoint: string
  label: string
  age_months: number
  status: 'pending' | 'due' | 'passed' | 'concern'
  concern_count: number
  assessed_at: string | null
  assessment_uuid: string | null
  notes: string | null
  items: MilestoneItem[]
  red_flags: MilestoneRedFlag[]
}

export interface MilestoneScheduleResponse {
  schedule: MilestoneCheckpoint[]
  current_age_months: number
}

export interface StoreMilestonePayload {
  age_checkpoint: string
  assessed_at: string
  items: { key: string; domain: string; result: string }[]
  notes?: string | null
}

// ── API ───────────────────────────────────────────────────────────────────────

export const pediatricsApi = {
  getBirthHistory(patientId: string): Promise<BirthHistoryResponse> {
    return http.get<BirthHistoryResponse>(`/patients/${patientId}/birth-history`)
  },

  updateBirthHistory(
    patientId: string,
    payload: { birth_history?: Partial<BirthHistoryFields>; feeding_history?: Partial<FeedingHistoryFields> },
  ): Promise<BirthHistoryResponse> {
    return http.put<BirthHistoryResponse>(`/patients/${patientId}/birth-history`, payload)
  },

  getImmunizations(patientId: string): Promise<{ data: ImmunizationTieredResponse }> {
    return http.get<{ data: ImmunizationTieredResponse }>(`/patients/${patientId}/immunizations`)
  },

  recordDose(patientId: string, payload: RecordDosePayload): Promise<{ data: ImmunizationDoseRecord }> {
    return http.post<{ data: ImmunizationDoseRecord }>(`/patients/${patientId}/immunizations`, payload)
  },

  deleteDose(patientId: string, doseUuid: string): Promise<void> {
    return http.delete<void>(`/patients/${patientId}/immunizations/${doseUuid}`)
  },

  getGrowthHistory(patientId: string): Promise<{ data: GrowthMeasurement[] }> {
    return http.get<{ data: GrowthMeasurement[] }>(`/patients/${patientId}/growth-history`)
  },

  getMilestones(patientId: string): Promise<{ data: MilestoneScheduleResponse }> {
    return http.get<{ data: MilestoneScheduleResponse }>(`/patients/${patientId}/developmental-milestones`)
  },

  storeMilestone(patientId: string, payload: StoreMilestonePayload): Promise<{ data: any }> {
    return http.post<{ data: any }>(`/patients/${patientId}/developmental-milestones`, payload)
  },

  deleteMilestone(patientId: string, assessmentUuid: string): Promise<void> {
    return http.delete<void>(`/patients/${patientId}/developmental-milestones/${assessmentUuid}`)
  },
}
