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
}

// ── Prenatal Visit (OB) ─────────────────────────────────────────────

export interface PrenatalTriage {
  concerns: string | null
  fetal_movement: 'present' | 'decreased' | 'not_yet_felt' | null
  kick_counts_performed: boolean | null
  danger_signs: string[]
  danger_signs_reviewed: boolean
  vitals: {
    bp_systolic: number | null
    bp_diastolic: number | null
    heart_rate: number | null
    respiratory_rate: number | null
    temperature: number | null
    weight: number | null
  }
}

export interface PrenatalAssessment {
  ob_exam: {
    fundal_height: number | null
    fh_consistent_with_ga: boolean | null
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
}

// ── Encounter Response ──────────────────────────────────────────────

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
  doctor_id: string
  doctor_name: string | null
  doctor_avatar_url: string | null
  finalized_at: string | null
  created_at: string
  updated_at: string
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
  triage?: Partial<ConsultationTriage> | Partial<PrenatalTriage> | Partial<PostpartumTriage>
  assessment?: Partial<ConsultationAssessment> | Partial<PrenatalAssessment> | Partial<PostpartumAssessment>
  specialty_assessment?: Record<string, unknown>
  treatment_plan?: Partial<ConsultationTreatmentPlan>
  // Prenatal/Postpartum plan section
  plan?: Partial<PrenatalPlan> | Partial<PostpartumPlan>
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

