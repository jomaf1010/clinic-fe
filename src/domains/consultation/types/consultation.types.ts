/** @deprecated Status is now on EncounterResponse. Use EncounterStatus from encounter.types. */
export type ConsultationStatus = 'draft' | 'finalized'
export type ConsultationType = 'default' | 'follow_up'

export interface LifestyleData {
  smoking?: 'never' | 'former' | 'current' | null
  pack_years?: number | null
  alcohol?: 'none' | 'social' | 'moderate' | 'heavy' | null
  exercise?: 'none' | 'light' | 'moderate' | 'vigorous' | null
  diet?: 'poor' | 'fair' | 'good' | 'excellent' | null
  medication_adherence?: 'non_adherent' | 'partial' | 'adherent' | null
}

export interface ProblemSoapNote {
  problem_id: string
  condition: string
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
}

export interface FMSpecialtyAssessment {
  problem_notes?: ProblemSoapNote[]
}

export interface ConsultationConsumable {
  consumable_id: string
  name: string
  quantity: number
  unit_price: number | null
}

export interface ConsultationTriage {
  chief_complaint: string | null
  vitals: Record<string, string | number | null>
  notes: string | null
  specialty_data?: {
    lifestyle?: LifestyleData
  } | null
}

export interface AssessmentDiagnosis {
  description: string
  code: string | null
  diagnosis_id: string | null
  source: 'icd' | 'manual'
}

export interface ConsultationAssessment {
  diagnoses: AssessmentDiagnosis[]
  notes: string | null
}

export interface ConsultationTreatmentPlan {
  advice: string | null
  follow_up: string | null
  follow_up_appointment_id: string | null
}

export interface ConsultationPayment {
  invoice_id?: string | null
  fee_discount_type?: 'percentage' | 'fixed' | null
  fee_discount_value?: number | null
}

export interface LabOrderSummary {
  status: string
  total: number
  pending: number
  completed: number
  pending_items: string[]
  completed_items: string[]
}

export interface PrescriptionSummary {
  total: number
  items: {
    drug_name: string
    dose: string
    frequency: string
    duration: string
    quantity?: number | null
    unit_price?: number | null
  }[]
}

export interface ConsultationDocument {
  id: string
  type: string
  status: string
}

/**
 * @deprecated Encounter-centric API: use EncounterResponse from encounter.types instead.
 * This type is kept for backward compatibility with existing views/components that
 * have not yet been migrated. Identity, status, and billing fields have moved to
 * EncounterResponse; clinical data is now nested under the `consultation` key there.
 */
export interface ConsultationResponse {
  id: string
  patient_id: string
  type: ConsultationType
  patient_name: string | null
  patient_sex: string | null
  clinic_id: string
  created_by: string
  doctor_name: string | null
  doctor_avatar_url: string | null
  status: ConsultationStatus
  triage: ConsultationTriage
  assessment: ConsultationAssessment
  specialty_assessment?: FMSpecialtyAssessment | null
  treatment_plan: ConsultationTreatmentPlan
  consumables: ConsultationConsumable[]
  payment: ConsultationPayment
  lab_order_summary: LabOrderSummary | null
  prescription_summary: PrescriptionSummary | null
  documents: ConsultationDocument[]
  invoice_id: string | null
  medcert_requested_by: string | null
  medcert_requested_at: string | null
  finalized_at: string | null
  display_line?: string | null
  auto_display_line?: string | null
  auto_display_summary?: string | null
  display_summary?: import('@/domains/encounter/types/encounter.types').DisplaySummary | null
  created_at: string
  updated_at: string
}

export interface CreateConsultationPayload {
  patient_id: string
  type?: ConsultationType
  specialty?: string | null
}

export interface UpdateConsultationPayload {
  triage?: Partial<ConsultationTriage>
  assessment?: Partial<ConsultationAssessment>
  specialty_assessment?: Record<string, unknown>
  treatment_plan?: Partial<ConsultationTreatmentPlan>
}

export interface ConsultationListResponse {
  data: ConsultationResponse[]
  meta: {
    pagination: {
      page: number
      per_page: number
      total: number
      last_page: number
    }
  }
}

export interface CreateConsultationResponse {
  data: ConsultationResponse
}

export interface ConsultationDetailResponse {
  data: ConsultationResponse
}

export interface UpdateConsultationResponse {
  data: ConsultationResponse
}

export interface FinalizeConsultationResponse {
  data: ConsultationResponse
}
