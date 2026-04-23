export interface PreviousPregnancy {
  year: number | null
  outcome: 'term' | 'preterm' | 'abortion' | 'ectopic' | 'molar' | null
  delivery_type: 'nvd' | 'cs' | 'vacuum' | 'forceps' | null
  complications: string | null
  sex: 'male' | 'female' | null
  birth_weight: number | null
  notes: string | null
}

export interface ContraceptiveEntry {
  method: ContraceptionMethod[]
  start_date: string
  end_date: string | null
  notes: string | null
}

export type ContraceptionMethod =
  | 'none'
  | 'pills'
  | 'pop'
  | 'iud_copper'
  | 'iud_hormonal'
  | 'implant'
  | 'injectable'
  | 'condoms'
  | 'withdrawal'
  | 'nfp'
  | 'lam'
  | 'sterilization_female'
  | 'salpingectomy'
  | 'sterilization_male'
  | 'patch'
  | 'ring'
  | 'other'

export const CONTRACEPTION_OPTIONS: { value: ContraceptionMethod; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'pills', label: 'Combined Oral Contraceptive Pills' },
  { value: 'pop', label: 'Progestin-Only Pills (POP/Minipill)' },
  { value: 'iud_copper', label: 'IUD — Copper' },
  { value: 'iud_hormonal', label: 'IUD — Hormonal' },
  { value: 'implant', label: 'Subdermal Implant' },
  { value: 'injectable', label: 'Injectable (DMPA)' },
  { value: 'condoms', label: 'Condoms' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'nfp', label: 'Natural Family Planning' },
  { value: 'lam', label: 'Lactational Amenorrhea Method (LAM)' },
  { value: 'sterilization_female', label: 'Bilateral Tubal Ligation (BTL)' },
  { value: 'salpingectomy', label: 'Bilateral Salpingectomy' },
  { value: 'sterilization_male', label: 'Vasectomy' },
  { value: 'patch', label: 'Contraceptive Patch' },
  { value: 'ring', label: 'Vaginal Ring' },
  { value: 'other', label: 'Other' },
]

export function contraceptionLabel(method: string): string {
  return CONTRACEPTION_OPTIONS.find((o) => o.value === method)?.label ?? method.replace(/_/g, ' ')
}

export type ScreeningType = 'pap_smear' | 'hpv_test' | 'pap_hpv_cotest' | 'mammogram' | 'breast_ultrasound' | 'other'

export const SCREENING_TYPE_OPTIONS: { value: ScreeningType; label: string }[] = [
  { value: 'pap_smear', label: 'Pap Smear' },
  { value: 'hpv_test', label: 'HPV Test' },
  { value: 'pap_hpv_cotest', label: 'Pap + HPV Co-test' },
  { value: 'mammogram', label: 'Mammogram' },
  { value: 'breast_ultrasound', label: 'Breast Ultrasound' },
  { value: 'other', label: 'Other' },
]

export function screeningTypeLabel(type: string): string {
  return SCREENING_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type.replace(/_/g, ' ')
}

export interface ScreeningEntry {
  date: string
  type: ScreeningType
  result: string | null
  notes: string | null
}

export interface GynSurgery {
  procedure: string
  date: string | null
  indication: string | null
  notes: string | null
}

export interface GynProfile {
  id: string
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
  contraception: ContraceptiveEntry[]
  screenings: ScreeningEntry[]
  gyn_surgeries: GynSurgery[]
  breast_risk_factors: string[]
}

export type PregnancyStatus = 'active' | 'delivered' | 'resolved' | 'postpartum' | 'inactive'

export type PregnancyOutcome =
  | 'live_birth'
  | 'preterm_birth'
  | 'stillbirth'
  | 'miscarriage'
  | 'ectopic'
  | 'molar'
  | 'termination'

export const DELIVERY_OUTCOMES: PregnancyOutcome[] = ['live_birth', 'preterm_birth', 'stillbirth']
export const LOSS_OUTCOMES: PregnancyOutcome[] = ['miscarriage', 'ectopic', 'molar', 'termination']

export const PREGNANCY_OUTCOME_OPTIONS: { value: PregnancyOutcome; label: string; description: string; category: 'delivery' | 'loss' }[] = [
  { value: 'live_birth', label: 'Live Birth (Term)', description: 'Full-term delivery at 37+ weeks', category: 'delivery' },
  { value: 'preterm_birth', label: 'Preterm Birth', description: 'Live birth before 37 weeks', category: 'delivery' },
  { value: 'stillbirth', label: 'Stillbirth', description: 'Fetal demise at 20+ weeks', category: 'delivery' },
  { value: 'miscarriage', label: 'Miscarriage', description: 'Spontaneous pregnancy loss before 20 weeks', category: 'loss' },
  { value: 'ectopic', label: 'Ectopic Pregnancy', description: 'Pregnancy outside the uterus', category: 'loss' },
  { value: 'molar', label: 'Molar Pregnancy', description: 'Abnormal growth of trophoblastic tissue', category: 'loss' },
  { value: 'termination', label: 'Termination', description: 'Elective or therapeutic termination', category: 'loss' },
]

export function pregnancyOutcomeLabel(outcome: string): string {
  return PREGNANCY_OUTCOME_OPTIONS.find((o) => o.value === outcome)?.label ?? outcome.replace(/_/g, ' ')
}

export interface PregnancyOutcomeDetails {
  management?: 'expectant' | 'medical' | 'surgical' | null
  ectopic_location?: string | null
  ectopic_confirmation?: string | null
  hcg_surveillance?: boolean | null
  notes?: string | null
}

export interface Pregnancy {
  id: string
  patient_id: string
  clinic_id: string
  lmp: string | null
  edd: string | null
  edd_source: 'lmp' | 'ultrasound' | 'adjusted' | null
  first_ultrasound_date: string | null
  first_ultrasound_ga: string | null
  medical_conditions: string | null
  surgical_history: string | null
  blood_type_rh: string | null
  smoking: string | null
  alcohol: string | null
  ipv_screened: boolean | null
  pre_pregnancy_weight: number | null
  height: number | null
  pre_pregnancy_bmi: number | null
  recommended_weight_gain: string | null
  risk_level: 'low' | 'high' | null
  risk_factors: string[]
  status: PregnancyStatus
  outcome: PregnancyOutcome | null
  outcome_date: string | null
  outcome_ga_weeks: number | null
  outcome_ga_days: number | null
  outcome_details: PregnancyOutcomeDetails | null
  delivered_at: string | null
  delivery_type: string | null
  birth_weight: number | null
  birth_gender: string | null
  delivery_encounter_id: string | null
  fetus_count: number
  fetuses: { label: string; sex: 'male' | 'female' | 'unknown' }[]
  prenatal_checklist: Record<string, { completed_at: string; notes?: string }> | null
  current_ga: { weeks: number; days: number; trimester: string } | null
  weeks_to_edd: number | null
  created_at: string
  updated_at: string
}

export interface PrenatalVisit {
  id: string
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

export interface ChecklistItem {
  key: string
  name: string
  type: 'lab' | 'procedure' | 'treatment'
  ga_min: number
  ga_max: number | null
  ga_window: string
  status: 'due' | 'overdue' | 'upcoming' | 'completed'
  completed_at: string | null
  notes: string | null
}

export interface DueReminders {
  labs: { key: string; name: string; ga_window: string; status: string }[]
  procedures: { key: string; name: string; ga_window: string; status: string }[]
}

/** @deprecated Use ChecklistItem instead */
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

export interface BpTrendPoint {
  date: string
  gestational_age_weeks: number | null
  systolic: number
  diastolic: number
}

export interface WeightTrendPoint {
  date: string
  gestational_age_weeks: number | null
  cumulative_gain: number
  status: string | null
}

export interface FundalHeightTrendPoint {
  date: string
  gestational_age_weeks: number | null
  fundal_height: number
  expected: number | null
}

export interface FhrTrendPoint {
  date: string
  gestational_age_weeks: number | null
  fetal_heart_rate: number
}

export interface DeliverySummary {
  delivered_at: string | null
  delivery_mode: string | null
  laceration: string | null
  blood_loss_ml: number | null
  complications: string[]
  transfusion: boolean
  maternal_outcome: string | null
  birth_weight_grams: number | null
  birth_gender: string | null
  apgar_1min: number | null
  apgar_5min: number | null
  neonatal_outcome: string | null
  ga_weeks: number | null
  ga_days: number | null
}

export interface PostpartumVisitSummary {
  id: string
  days_postpartum: number | null
  created_at: string
  bp_systolic: number | null
  bp_diastolic: number | null
  weight: number | null
  lochia: string | null
  wound_healing: string | null
  phq2_total: number | null
  phq2_risk: string | null
  contraception_discussed: boolean
  contraception_method: string | string[] | null
  infant_feeding: string | null
  return_to_activity_cleared: boolean
  sexual_activity_cleared: boolean
  next_visit_date: string | null
}

export interface PregnancyDashboard {
  pregnancy: Pregnancy
  visit_count: number
  last_visit_date: string | null
  next_visit_date: string | null
  labs_due_count: number
  danger_signs_last_visit: string[]
  bp_trend: BpTrendPoint[]
  weight_trend: WeightTrendPoint[]
  fundal_height_trend: FundalHeightTrendPoint[]
  fhr_trend: FhrTrendPoint[]
  visit_summary: { count: number; first_date: string | null; last_date: string | null }
  // Postpartum (present when status is delivered/postpartum)
  delivery_summary?: DeliverySummary | null
  postpartum_visits?: PostpartumVisitSummary[]
  postpartum_bp_trend?: BpTrendPoint[]
  postpartum_weight_trend?: { date: string; weight: number; gestational_age_weeks: null; days_postpartum: number | null }[]
}
