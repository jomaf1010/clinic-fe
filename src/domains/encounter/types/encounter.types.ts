import type {
  ConsultationTriage,
  ConsultationAssessment,
  ConsultationTreatmentPlan,
  ConsultationPayment,
  ConsultationConsumable,
  LabOrderSummary,
  PrescriptionSummary,
  ConsultationDocument,
  FMSpecialtyAssessment,
} from '@/domains/consultation/types/consultation.types'
import type { DentalVisitData } from '@/domains/dental/types/dental.types'
import type { SoapNote } from './soapNote.types'

export type { DentalVisitData }
export type { SoapDraftApiResponse, SoapDraftResponse, SoapNote } from './soapNote.types'

export type EncounterType = 'consultation' | 'prenatal' | 'delivery' | 'postpartum' | 'dental'
export type EncounterStatus = 'draft' | 'finalized'

export interface ConsultationData {
  id: string
  type: 'default' | 'follow_up'
  triage: ConsultationTriage
  bmi: number | null
  assessment: ConsultationAssessment
  specialty_assessment?: FMSpecialtyAssessment | null
  treatment_plan: ConsultationTreatmentPlan
  soap_note?: SoapNote | null
}

// ── Prenatal Visit (OB) ─────────────────────────────────────────────

export interface PrenatalTriage {
  concerns: string | null
  fetal_movement: 'present' | 'decreased' | 'not_yet_felt' | null
  kick_counts_performed: boolean | null
  danger_signs: string[]
  danger_signs_reviewed: boolean
  mood_screening: 'no_concerns' | 'low_mood_anxiety' | 'referred' | null
  vitals: {
    bp_systolic: number | null
    bp_diastolic: number | null
    heart_rate: number | null
    respiratory_rate: number | null
    temperature: number | null
    weight: number | null
    spo2: number | null
    urine_protein: string | null
    urine_sugar: string | null
  }
}

export interface PrenatalAssessment {
  ob_exam: {
    fundal_height: number | null
    fh_consistent_with_ga: 'consistent' | 'large_for_dates' | 'small_for_dates' | null
    fetal_heart_rate: number | null
    fhr_method: 'doppler' | 'fetoscope' | 'ctg' | null
    fetal_presentation: string | null
    fetal_lie: string | null
    engagement: string | null
    leopolds_performed: boolean | null
    edema: string | null
    edema_location: string[]
    abdominal_exam: string | null
    speculum_exam: string | null
    breast_exam: string | null
  }
  cervical: {
    cervical_dilation: number | null
    cervical_effacement: number | null
    cervical_consistency: string | null
    cervical_position: string | null
    fetal_station: number | null
    bishop_score: number | null
  }
  ultrasound: {
    type: string | null
    findings: string | null
    date: string | null
    ga_weeks: number | null
    ga_days: number | null
    edd: string | null
  }
  pregnancy_progress: 'normal' | 'concerning' | 'complication' | null
  risk_level_update: 'low' | 'moderate' | 'high' | null
  new_risk_factors: string[]
  complications: string[]
  diagnoses: Array<{ description: string; code: string | null; diagnosis_id: string | null; source: 'icd' | 'manual' }>
  notes: string | null
}

export interface PrenatalPlan {
  next_visit_date: string | null
  counseling_provided: string[]
  birth_plan_discussed: boolean
  education_provided: string[]
  referrals: string[]
  notes: string | null
}

export interface PrenatalVisitData {
  id: string
  pregnancy_id: string
  visit_number: number | null
  visit_date: string | null
  gestational_age_weeks: number | null
  gestational_age_days: number | null
  trimester: string | null
  weeks_to_edd: number | null
  weight_gain_this_visit: number | null
  cumulative_weight_gain: number | null
  weight_gain_status: string | null
  triage: PrenatalTriage
  assessment: PrenatalAssessment
  plan: PrenatalPlan
  soap_note?: SoapNote | null
}

// ── Delivery Record (OB) ────────────────────────────────────────────

export interface DeliveryLabor {
  onset_type: 'spontaneous' | 'induced' | 'elective_cesarean' | null
  labor_start: string | null
  labor_duration_hours: number | null
  induction_method: string | null
  augmentation: string | null
}

export interface DeliveryOutcome {
  delivery_datetime: string | null
  delivery_mode: 'vaginal_spontaneous' | 'vacuum' | 'forceps' | 'cesarean' | null
  indication_for_intervention: string | null
  laceration_degree: 'none' | '1st' | '2nd' | '3rd' | '4th' | null
}

export interface DeliveryMaternal {
  blood_loss_ml: number | null
  complications: string[]
  blood_transfusion_required: boolean
  maternal_outcome: 'good' | 'morbidity' | 'mortality' | null
}

export interface DeliveryNeonatal {
  birth_weight_grams: number | null
  birth_gender: 'M' | 'F' | null
  apgar_1min: number | null
  apgar_5min: number | null
  apgar_10min: number | null
  cord_ph: number | null
  complications: string[]
  resuscitation_required: boolean
  neonatal_outcome: 'live_birth_well' | 'live_birth_complication' | 'stillbirth' | null
}

export interface DeliveryRecordData {
  id: string
  pregnancy_id: string
  labor: DeliveryLabor
  delivery: DeliveryOutcome
  maternal: DeliveryMaternal
  neonatal: DeliveryNeonatal
  notes: string | null
  soap_note?: SoapNote | null
}

// ── Postpartum Visit (OB) ───────────────────────────────────────────

export interface PostpartumTriage {
  concerns: string | null
  vitals: {
    bp_systolic: number | null
    bp_diastolic: number | null
    heart_rate: number | null
    respiratory_rate: number | null
    temperature: number | null
    weight: number | null
  }
}

export interface PostpartumAssessment {
  general_recovery: string | null
  lochia: 'minimal' | 'moderate' | 'heavy' | 'none' | null
  wound_healing: 'intact' | 'partial_separation' | 'infected' | null
  incision_notes: string | null
  breast_exam: string | null
  abdominal_exam: string | null
  phq2: {
    q1: number | null
    q2: number | null
    total: number | null
    risk_level: 'none' | 'low' | 'moderate' | 'high' | null
  }
}

export interface PostpartumPlan {
  contraception_discussed: boolean
  contraception_method: string | null
  infant_feeding: 'breastfeeding' | 'formula' | 'mixed' | null
  breastfeeding_challenges: string | null
  return_to_activity_cleared: boolean
  sexual_activity_cleared: boolean
  additional_follow_up_needed: boolean
  next_visit_date: string | null
  notes: string | null
}

export interface PostpartumVisitData {
  id: string
  pregnancy_id: string
  days_postpartum: number | null
  triage: PostpartumTriage
  assessment: PostpartumAssessment
  plan: PostpartumPlan
  soap_note?: SoapNote | null
}

// ── Encounter Response ──────────────────────────────────────────────

// ── Display Summary (rich encounter summary for timeline) ───────────────

export interface DisplaySummaryVitals {
  bp_systolic?: number | null
  bp_diastolic?: number | null
  hr?: number | null
  rr?: number | null
  temp?: number | null
  spo2?: number | null
  blood_sugar?: number | null
  blood_glucose_timing?: string | null
  weight?: number | null
  height?: number | null
  pain_score?: number | null
  waist_circumference?: number | null
  head_circumference?: number | null
  [key: string]: number | string | null | undefined
}

export type BpClassification = 'normal' | 'elevated' | 'stage_1' | 'stage_2' | 'crisis'
export type BloodSugarClassification = 'hypoglycemia' | 'normal' | 'prediabetic' | 'diabetic'

export type DisplaySummaryContext =
  | {
      kind: 'consultation'
      specialty: 'pediatrics'
      consultation_type: string
      age_months?: number
      weight_kg?: number
      height_cm?: number
      head_circumference_cm?: number
    }
  | {
      kind: 'consultation'
      specialty: 'family_medicine' | 'internal_medicine'
      consultation_type: string
      bp_classification?: BpClassification
      blood_sugar_classification?: BloodSugarClassification
    }
  | {
      kind: 'consultation'
      specialty: string
      consultation_type: string
    }
  | {
      kind: 'prenatal'
      visit_number?: number
      ga_weeks?: number
      ga_days?: number
      fundal_height_cm?: number
      fetal_heart_rate?: number
    }
  | {
      kind: 'delivery'
      delivery_mode?: string
      birth_weight_grams?: number
      birth_gender?: string
      apgar_5min?: number
    }
  | {
      kind: 'postpartum'
      days_postpartum?: number
    }
  | {
      kind: 'dental'
      pain_score?: number | null
      procedure_count?: number
      teeth_worked_on?: string[]
      teeth_examined_count?: number
      perio_psr_max?: number | null
    }

export interface DisplaySummary {
  chief_complaint: string | null
  diagnoses: string[]
  vitals: DisplaySummaryVitals
  context: DisplaySummaryContext
}

export interface EncounterResponse {
  id: string
  patient_id: string
  clinic_id: string
  doctor_id: string
  appointment_id: string | null
  pregnancy_id: string | null
  type: EncounterType
  specialty: string
  status: EncounterStatus
  display_line: string | null
  auto_display_line: string | null
  auto_display_summary: string | null
  display_summary: DisplaySummary | null
  patient_name: string | null
  patient_sex: string | null
  doctor_name: string | null
  doctor_avatar_url: string | null
  consumables: ConsultationConsumable[]
  procedures: Array<{ service_id: string; name: string; quantity: number; unit_price: number | null; notes: string | null }>
  payment: ConsultationPayment
  invoice_id: string | null
  medcert_requested_by: string | null
  medcert_requested_at: string | null
  finalized_at: string | null
  created_at: string
  updated_at: string
  consultation?: ConsultationData | null
  prenatal_visit?: PrenatalVisitData | null
  delivery_record?: DeliveryRecordData | null
  postpartum_visit?: PostpartumVisitData | null
  dental_visit?: DentalVisitData | null
  lab_order_summary: LabOrderSummary | null
  prescription_summary: PrescriptionSummary | null
  documents: ConsultationDocument[]
}

export interface EncounterTimelineItem {
  id: string
  type: EncounterType
  specialty: string
  pregnancy_id: string | null
  status: EncounterStatus
  display_line: string | null
  auto_display_line: string | null
  auto_display_summary: string | null
  display_summary: DisplaySummary | null
  doctor_id: string
  doctor_name: string | null
  doctor_avatar_url: string | null
  finalized_at: string | null
  created_at: string
  updated_at: string
  // Optional rich fields for cards/detail panels — not always returned by
  // the timeline endpoint but consumed by `DraftConsultationCard`,
  // `FinalizedConsultationCard`, and the patient-detail view.
  patient_id?: string
  patient_name?: string | null
  patient_sex?: string | null
  consultation_type?: 'default' | 'follow_up'
  triage?: ConsultationTriage
  lab_order_summary?: LabOrderSummary | null
  prescription_summary?: PrescriptionSummary | null
  documents?: ConsultationDocument[]
  medcert_requested_by?: string | null
  medcert_requested_at?: string | null
  chief_complaint?: string | null
}

export interface CreateEncounterPayload {
  patient_id: string
  type?: EncounterType
  specialty?: string
  consultation_type?: 'default' | 'follow_up'
  pregnancy_id?: string
}

export interface UpdateEncounterPayload {
  // Consultation sections
  triage?: Partial<ConsultationTriage> | Partial<PrenatalTriage> | Partial<PostpartumTriage> | Partial<import('@/domains/dental/types/dental.types').DentalVisitTriage>
  assessment?: Partial<ConsultationAssessment> | Partial<PrenatalAssessment> | Partial<PostpartumAssessment> | Partial<import('@/domains/dental/types/dental.types').DentalVisitAssessment>
  specialty_assessment?: Record<string, unknown>
  treatment_plan?: Partial<ConsultationTreatmentPlan>
  soap_note?: SoapNote
  // Prenatal/Postpartum/Dental plan section
  plan?: Partial<PrenatalPlan> | Partial<PostpartumPlan> | Partial<import('@/domains/dental/types/dental.types').DentalVisitPlan>
  // Dental — link a visit to a treatment plan episode
  treatment_plan_id?: string | null
  // Delivery sections
  labor?: Partial<DeliveryLabor>
  delivery?: Partial<DeliveryOutcome>
  maternal?: Partial<DeliveryMaternal>
  neonatal?: Partial<DeliveryNeonatal>
  notes?: string
}

export interface EncounterListResponse {
  data: EncounterTimelineItem[]
  meta: {
    pagination: {
      page: number
      per_page: number
      total: number
      last_page: number
    }
  }
}

export interface EncounterDetailResponse {
  data: EncounterResponse
}

export interface CreateEncounterResponse {
  data: EncounterResponse
}

export interface UpdateEncounterResponse {
  data: EncounterResponse
}

export interface FinalizeEncounterResponse {
  data: EncounterResponse
}

// Re-export clinical types for consumer convenience
export type {
  ConsultationTriage,
  ConsultationAssessment,
  ConsultationTreatmentPlan,
  ConsultationPayment,
  ConsultationConsumable,
  LabOrderSummary,
  PrescriptionSummary,
  ConsultationDocument,
  FMSpecialtyAssessment,
} from '@/domains/consultation/types/consultation.types'
