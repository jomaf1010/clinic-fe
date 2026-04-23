// FDI tooth numbering: first digit = quadrant (1=UR, 2=UL, 3=LL, 4=LR
// permanent; 5=UR, 6=UL, 7=LL, 8=LR primary), second digit = position
// from midline (1-8 permanent, 1-5 primary). Tooth IDs are stored as
// strings to preserve leading zeros if any (none in FDI but matches
// MongoDB key shape).

export type CariesStatus = 'none' | 'early' | 'moderate' | 'severe' | 'treated'
export type RestorationType =
  | 'amalgam' | 'composite' | 'temporary' | 'glass_ionomer' | 'rmgi' | 'ceramic' | 'crown' | 'gold'
export type RestorationCondition =
  | 'intact' | 'small_defect' | 'large_defect' | 'breakdown' | 'secondary_caries'
export type FractureStatus = 'crack_minor' | 'crack_major' | 'cusp' | 'root' | 'split'
export type SealantStatus = 'none' | 'partial' | 'complete' | 'lost'

export type ToothSurface = 'occlusal' | 'mesial' | 'distal' | 'buccal' | 'lingual'

export interface ToothSurfaces {
  occlusal?: boolean
  mesial?: boolean
  distal?: boolean
  buccal?: boolean
  lingual?: boolean
}

export interface ToothState {
  caries?: CariesStatus | null
  restoration?: RestorationType | null
  condition?: RestorationCondition | null
  fracture?: FractureStatus | null
  missing?: boolean | null
  missing_date?: string | null
  sealant?: SealantStatus | null
  // Which tooth surfaces are marked (for MOD/DO/etc. codes)
  surfaces?: ToothSurfaces | null
  notes?: string | null
}

export type Odontogram = Record<string, ToothState>

export interface PerioPSR {
  sextant_1?: number | null
  sextant_2?: number | null
  sextant_3?: number | null
  sextant_4?: number | null
  sextant_5?: number | null
  sextant_6?: number | null
}

export type CariesRisk = 'low' | 'moderate' | 'high'
export type OralHygiene = 'good' | 'fair' | 'poor'

export interface DentalProfile {
  id: string
  patient_id: string
  clinic_id: string
  odontogram: Odontogram
  perio_psr: PerioPSR | null
  dmft_score: number | null
  dmft_decayed: number | null
  dmft_missing: number | null
  dmft_filled: number | null
  dmft_score_primary: number | null
  caries_risk: CariesRisk | null
  oral_hygiene: OralHygiene | null
  dental_history: unknown[] | null
  habits: Record<string, unknown> | null
  medical_flags: Record<string, unknown> | null
  philhealth_member: boolean | null
  philhealth_id: string | null
  blood_type: string | null
  notes: string | null
  last_visit_at: string | null
  created_at: string | null
  updated_at: string | null
}

export type TreatmentPlanPhase = 'urgent' | 'control' | 'reevaluation' | 'definitive' | 'maintenance'
export type TreatmentPlanStatus = 'active' | 'completed' | 'abandoned'
export type TreatmentLineStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'

export interface TreatmentLineItem {
  id: string
  phase: TreatmentPlanPhase
  procedure: string
  teeth?: string[]
  cost_estimate?: number | null
  status?: TreatmentLineStatus
  visit_id?: string | null
  completed_at?: string | null
  notes?: string | null
}

export interface DentalTreatmentPlan {
  id: string
  patient_id: string
  clinic_id: string
  created_by: string
  status: TreatmentPlanStatus
  chief_complaint: string | null
  line_items: TreatmentLineItem[]
  total_estimated_cost: number | null
  notes: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface DentalVisitVitals {
  bp_systolic?: number | null
  bp_diastolic?: number | null
  hr?: number | null
  temp?: number | null
  spo2?: number | null
  pain_score?: number | null
}

export interface DentalVisitTriage {
  chief_complaint?: string | null
  pain_score?: number | null
  anxiety?: 'none' | 'mild' | 'moderate' | 'severe' | null
  notes?: string | null
  vitals?: DentalVisitVitals
}

export interface DentalVisitAssessment {
  odontogram_delta?: Odontogram
  perio_psr?: PerioPSR | null
  dental_findings?: string | null
  diagnoses?: string[]
  notes?: string | null
}

export interface DentalProcedureLog {
  id?: string
  procedure: string
  teeth?: string[]
  materials?: string[]
  plan_item_id?: string | null
  service_id?: string | null
  billable_amount?: number | null
  notes?: string | null
}

export interface DentalVisitPlan {
  procedures?: DentalProcedureLog[]
  next_visit_recommendation?: string | null
  education_provided?: string[]
  referrals?: string[]
  notes?: string | null
}

export interface DentalVisitData {
  id: string
  treatment_plan_id: string | null
  visit_number: number | null
  visit_date: string | null
  triage: DentalVisitTriage | null
  assessment: DentalVisitAssessment | null
  plan: DentalVisitPlan | null
}

export interface DentalVisitDetail extends DentalVisitData {
  encounter_id: string
  patient_id: string
  clinic_id: string
  doctor_id: string
  created_at: string | null
  updated_at: string | null
}

export interface UpsertDentalProfilePayload {
  odontogram?: Odontogram
  perio_psr?: PerioPSR
  caries_risk?: CariesRisk | null
  oral_hygiene?: OralHygiene | null
  dental_history?: unknown[]
  habits?: Record<string, unknown>
  medical_flags?: Record<string, unknown>
  philhealth_member?: boolean | null
  philhealth_id?: string | null
  blood_type?: string | null
  notes?: string | null
}

export interface CreateTreatmentPlanPayload {
  chief_complaint?: string | null
  line_items?: TreatmentLineItem[]
  total_estimated_cost?: number | null
  notes?: string | null
}

export interface UpdateTreatmentPlanPayload extends CreateTreatmentPlanPayload {
  status?: TreatmentPlanStatus
}

export interface UpdateDentalVisitPayload {
  treatment_plan_id?: string | null
  triage?: DentalVisitTriage
  assessment?: DentalVisitAssessment
  plan?: DentalVisitPlan
}
