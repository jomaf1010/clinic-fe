export interface PreviousPregnancy {
  year: number | null
  outcome: 'term' | 'preterm' | 'abortion' | 'ectopic' | 'molar' | null
  sex: 'male' | 'female' | null
  birth_weight: number | null
  notes: string | null
}

export interface ContraceptiveEntry {
  method: string
  start_date: string | null
  end_date: string | null
  reason_stopped: string | null
}

export interface CurrentContraception {
  method: string
  started_date: string | null
}

export interface GynSurgery {
  procedure: string
  date: string | null
  indication: string | null
  notes: string | null
}

export interface GynProfile {
  uuid: string
  patient_id: string
  clinic_id: string
  menarche_age: number | null
  cycle_length: number | null
  regularity: 'regular' | 'irregular' | null
  duration: number | null
  flow: 'light' | 'moderate' | 'heavy' | null
  dysmenorrhea: 'none' | 'mild' | 'moderate' | 'severe' | null
  gravidity: number | null
  parity_term: number | null
  parity_preterm: number | null
  abortions: number | null
  living_children: number | null
  previous_pregnancies: PreviousPregnancy[]
  contraceptive_history: ContraceptiveEntry[]
  current_contraception: CurrentContraception | null
  last_pap_date: string | null
  last_pap_result: string | null
  hpv_status: string | null
  screening_interval: string | null
  gyn_surgeries: GynSurgery[]
  breast_risk_factors: string[]
}

export interface Pregnancy {
  uuid: string
  patient_id: string
  clinic_id: string
  lmp: string | null
  edd: string | null
  edd_source: 'lmp' | 'ultrasound' | 'adjusted' | null
  gravidity: number | null
  parity_term: number | null
  parity_preterm: number | null
  abortions: number | null
  living_children: number | null
  pre_pregnancy_weight: number | null
  pre_pregnancy_bmi: number | null
  recommended_weight_gain: { min: number; max: number } | null
  risk_level: 'low' | 'high' | null
  risk_factors: string[]
  status: 'active' | 'delivered' | 'lost' | 'postpartum' | 'inactive'
  current_ga: { weeks: number; days: number; trimester: string } | null
  weeks_to_edd: number | null
  created_at: string
  updated_at: string
}

export interface PrenatalVisit {
  uuid: string
  pregnancy_id: string
  visit_number: number
  visit_date: string
  gestational_age_weeks: number | null
  gestational_age_days: number | null
  trimester: string | null
  concerns: string | null
  fetal_movement: string | null
  danger_signs: string[]
  bp_systolic: number | null
  bp_diastolic: number | null
  weight: number | null
  weight_gain_this_visit: number | null
  cumulative_weight_gain: number | null
  weight_gain_status: string | null
  fundal_height: number | null
  fetal_heart_rate: number | null
  fetal_presentation: string | null
  pregnancy_progress: string | null
  risk_level_update: string | null
  complications: string[]
  next_visit_date: string | null
  created_at: string
}

export interface LabsDueItem {
  key: string
  name: string
  trimester: string
  due_at_weeks: number | null
  status: 'due' | 'ordered' | 'completed' | 'overdue'
  ordered_date: string | null
  completed_date: string | null
  result: string | null
}

export interface PregnancyDashboard {
  pregnancy: Pregnancy
  visit_count: number
  last_visit_date: string | null
  next_visit_date: string | null
  labs_due_count: number
  danger_signs_last_visit: string[]
}
