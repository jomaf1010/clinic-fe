export type ConsultationStatus = 'draft' | 'finalized'
export type ConsultationType = 'default' | 'follow_up'

export interface ConsultationConsumable {
  consumable_id: string
  name: string
  quantity: number
  unit_price: number | null
}

export interface TriageVitals {
  bp: string | null
  hr: number | null
  rr: number | null
  temp: number | null
  spo2: number | null
  blood_sugar: number | null
}

export interface ConsultationTriage {
  chief_complaint: string | null
  vitals: TriageVitals
  weight: number | null
  height: number | null
  pain_score: number | null
  notes: string | null
  extended_vitals?: Record<string, string | number | null>
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
  patient_allergies: string[]
  patient_conditions: string[]
  assessment: ConsultationAssessment
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
