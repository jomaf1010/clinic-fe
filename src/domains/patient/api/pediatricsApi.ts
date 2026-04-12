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

export interface RecordDosePayload {
  vaccine_key: string
  dose_number: number
  date_given: string
  batch_number?: string | null
  site?: string | null
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

  getImmunizations(patientId: string): Promise<{ data: ImmunizationVaccineGroup[] }> {
    return http.get<{ data: ImmunizationVaccineGroup[] }>(`/patients/${patientId}/immunizations`)
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
}
