// FDI tooth numbering: first digit = quadrant (1=UR, 2=UL, 3=LL, 4=LR
// permanent; 5=UR, 6=UL, 7=LL, 8=LR primary), second digit = position
// from midline (1-8 permanent, 1-5 primary). Tooth IDs are stored as
// strings to preserve leading zeros if any (none in FDI but matches
// MongoDB key shape).

import type { SoapNote } from '@/domains/encounter/types/soapNote.types'

// ---- Shared enums ----

export type CariesSeverity = 'early' | 'moderate' | 'severe'
export type FillingMaterial = 'amalgam' | 'composite' | 'glass_ionomer' | 'rmgi' | 'temporary'
export type CrownMaterial = 'zircon' | 'metal' | 'pfm' | 'porcelain' | 'emax' | 'resin' | 'temporary'
export type RestorationCondition =
  | 'intact' | 'small_defect' | 'large_defect' | 'breakdown' | 'secondary_caries'
export type FractureVariant =
  | 'mesial' | 'distal' | 'incisal' | 'mesial-distal' | 'mesial-incisal'
  | 'distal-incisal' | 'mesial-distal-incisal'
export type SealantValue = 'partial' | 'complete' | 'lost'
export type EndoType = 'endo-filling' | 'endo-filling-incomplete' | 'endo-resection' | 'pulpotomy'
export type PostMaterial = 'glass' | 'metal'
export type ImplantStage = 'base' | 'healing-abutment' | 'bar' | 'locator-screw'
export type BridgeMaterial = 'zircon' | 'metal' | 'telescope' | 'temporary' | 'prosthesis'
export type BridgeRole = 'abutment' | 'pontic'
export type BruxismVariant = 'wear' | 'neck-wear' | 'both'
export type ModKind = 'inflammation-inside' | 'inflammation-outside' | 'mobility'
export type SpecialKind = 'extraction-plan' | 'crown-needed' | 'crown-replace' | 'missing-closed'
export type ToothBase = 'tooth' | 'milktooth' | 'implant'

export type ToothSurface = 'occlusal' | 'incisal' | 'mesial' | 'distal' | 'buccal' | 'lingual'

// ---- v2 / stamped shape (canonical, matches backend DentalProfile.odontogram wire format) ----

export type TreatmentStatus = 'existing' | 'proposed' | 'completed'

/** Provenance stamp carried on every clinical leaf. */
export interface ClinicalStamp {
  status: TreatmentStatus
  source_visit_id: string | null
  recorded_at: string | null
  recorded_by: string | null
}

export interface StampedCaries extends ClinicalStamp {
  severity: CariesSeverity
}

export interface StampedFilling extends ClinicalStamp {
  material: FillingMaterial
}

export interface StampedSealant extends ClinicalStamp {
  value: SealantValue
}

export interface StampedCrown extends ClinicalStamp {
  material: CrownMaterial
}

export interface StampedEndo extends ClinicalStamp {
  type: EndoType
}

export interface StampedPost extends ClinicalStamp {
  material: PostMaterial
}

export interface StampedFracture extends ClinicalStamp {
  variant: FractureVariant
}

export interface StampedPulpitis extends ClinicalStamp {}

export interface StampedBruxism extends ClinicalStamp {
  variant: BruxismVariant
}

export interface StampedImplant extends ClinicalStamp {
  stage: ImplantStage
}

export interface StampedBridge extends ClinicalStamp {
  material: BridgeMaterial
  role: BridgeRole
}

export interface StampedMissing extends ClinicalStamp {
  /** Date tooth went missing (YYYY-MM-DD). */
  since?: string | null
  cause?: 'extraction' | 'congenital' | 'trauma' | null
}

export interface StampedMod extends ClinicalStamp {
  kind: ModKind
}

export interface StampedSpecial extends ClinicalStamp {
  kind: SpecialKind
}

/** Clinical leaves keyed per surface. */
export type SurfaceMap<T extends ClinicalStamp> = Partial<Record<ToothSurface, T>>

/**
 * Canonical v2 tooth shape — what the backend stores and the wire API returns.
 * A single tooth can legitimately carry overlapping states (e.g. existing
 * composite on occlusal + proposed crown + completed RCT).
 */
export interface StampedToothState {
  base?: ToothBase
  caries?: SurfaceMap<StampedCaries>
  fillings?: SurfaceMap<StampedFilling>
  sealants?: SurfaceMap<StampedSealant>
  crown?: StampedCrown | null
  endo?: StampedEndo | null
  post?: StampedPost | null
  fracture?: StampedFracture | null
  pulpitis?: StampedPulpitis | null
  bruxism?: StampedBruxism | null
  implant?: StampedImplant | null
  bridge?: StampedBridge | null
  missing?: StampedMissing | null
  mods?: StampedMod[]
  specials?: StampedSpecial[]
  notes?: string | null
}

export type StampedOdontogram = Record<string, StampedToothState>

/**
 * Partial delta sent from client → server. Leaves may omit provenance fields;
 * backend OdontogramMergeService fills them in on merge. `{__remove: true}`
 * on any clinical-field slot clears it.
 */
export type StampedOdontogramDelta = Record<string, Partial<StampedToothState>>

export interface PerioPSR {
  sextant_1?: number | null
  sextant_2?: number | null
  sextant_3?: number | null
  sextant_4?: number | null
  sextant_5?: number | null
  sextant_6?: number | null
}

/** Single probing point — pocket depth (mm) + bleeding on probing. */
export interface PerioPoint {
  pd: number | null
  bop: boolean
}

/** 6-point perio record per tooth: facial + lingual triads + mobility. */
export interface PerioToothRecord {
  /** MB, B, DB for buccal teeth; MB, B, DB on lower buccal side. */
  facial: [PerioPoint, PerioPoint, PerioPoint]
  /** ML, L/P, DL — palatal for upper, lingual for lower. */
  lingual: [PerioPoint, PerioPoint, PerioPoint]
  /** Miller mobility grade (0 = none, I/II/III). */
  mobility: 0 | 1 | 2 | 3
}

/** Full 6-point perio chart — FDI-keyed. */
export type PerioChart = Record<string, PerioToothRecord>

export type CariesRisk = 'low' | 'moderate' | 'high'
export type OralHygiene = 'good' | 'fair' | 'poor'

export interface DentalProfile {
  id: string
  patient_id: string
  clinic_id: string
  odontogram: StampedOdontogram
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
  /** CDT code (same vocabulary as the service catalog). */
  procedure: string
  teeth?: string[]
  /** Surfaces (mesial/distal/occlusal/incisal/buccal/lingual) for surface-driven procedures. */
  surfaces?: ToothSurface[]
  /** Optional material (composite/amalgam/zircon/pfm/etc.). */
  material?: string | null
  /** Catalog back-link so the resolver can skip CDT-lookup. */
  service_id?: string | null
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

/** Structured diagnosis line — matches consultation/encounter wire format. */
export interface DentalDiagnosis {
  description: string
  code?: string | null
  diagnosis_id?: string | null
  source: 'icd' | 'manual'
}

export interface DentalVisitAssessment {
  /** Partial stamped delta keyed by FDI; backend normalizes + stamps on merge. */
  odontogram_delta?: StampedOdontogramDelta
  perio_psr?: PerioPSR | null
  /** Full 6-point perio chart — only populated when PSR flags a detailed work-up. */
  perio_chart?: PerioChart | null
  dental_findings?: string | null
  /** Structured for the encounter API; the visit textarea flattens on hydrate. */
  diagnoses?: DentalDiagnosis[]
  notes?: string | null
}

export interface DentalProcedureLog {
  id?: string
  /** Display name or CDT code; prefer `cdt_code` for catalog lookup. */
  procedure: string
  cdt_code?: string
  teeth?: string[]
  surfaces?: ToothSurface[]
  material?: string | null
  materials?: string[]
  plan_item_id?: string | null
  service_id?: string | null
  billable_amount?: number | null
  notes?: string | null
}

export interface DentalVisitPlan {
  procedures?: DentalProcedureLog[]
  /** ISO date (YYYY-MM-DD) of the booked follow-up. */
  follow_up?: string | null
  /** UUID of the appointment created for the follow-up, or null. */
  follow_up_appointment_id?: string | null
  /** @deprecated replaced by `follow_up` + `follow_up_appointment_id`. Kept
   *  to round-trip legacy visit data without losing it. */
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
  soap_note?: SoapNote | null
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
  odontogram?: StampedOdontogram
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
  soap_note?: SoapNote
}

// ---- Fee schedule / catalog ----

export type DentalServiceCategory =
  | 'preventive'
  | 'restorative'
  | 'endodontic'
  | 'surgical'
  | 'periodontal'
  | 'prosthodontic'
  | 'implant'
  | 'orthodontic'
  | 'occlusal'
  | 'other'

export type TreatmentArea =
  | 'tooth'
  | 'surface'
  | 'quadrant'
  | 'sextant'
  | 'arch'
  | 'full_mouth'

export interface DentalServiceCatalogEntry {
  uuid: string
  clinic_service_uuid: string | null
  cdt_code: string
  name: string
  description: string | null
  category: DentalServiceCategory
  treatment_area: TreatmentArea
  surfaces_required: number | null
  material: string | null
  is_anterior: boolean | null
  is_posterior: boolean | null
  default_price: number
  price_min: number | null
  price_max: number | null
  /**
   * Clinic-wide price. Nullable — can be `null` when neither the clinic has
   * set a price nor the SystemService row has a default. Consumers should
   * guard before formatting (placeholder, range hint, etc.).
   * In doctor scope this is the fallback shown as a placeholder.
   * In clinic scope this is the editable value.
   */
  clinic_price: number | null
  /** Clinic-level activation flag. Always present. */
  clinic_is_active: boolean
  /**
   * Doctor's per-procedure price override. `null` means the doctor uses
   * the clinic price. Only meaningful in doctor scope; in clinic scope
   * the backend sets this to `null`.
   */
  override_price: number | null
  /**
   * Doctor's per-procedure activation override. `null` means the doctor
   * inherits `clinic_is_active`. Only meaningful in doctor scope.
   */
  override_is_active: boolean | null
  /** Backend-computed: `override_price ?? clinic_price`. */
  effective_price: number | null
  /** Backend-computed: `override_is_active ?? clinic_is_active`. */
  effective_is_active: boolean
  /**
   * Back-compat alias. In clinic scope == `clinic_is_active`.
   * In doctor scope == `effective_is_active`. Existing consumers
   * (auto-coder, odontogram display, visit view) read this.
   */
  is_active: boolean
}

export interface UpdateDentalServicePayload {
  price?: number | null
  is_active?: boolean
}

/**
 * Doctor-override upsert payload. `price === null` clears the price
 * override (falls back to clinic price). `is_active === null` clears
 * the activation override (falls back to clinic activation). When both
 * are null, the backend deletes the override row entirely.
 */
export interface UpdateDoctorDentalServicePayload {
  price?: number | null
  is_active?: boolean | null
}

// ---- Per-tooth history ----

export type ToothHistoryEventType = 'assessment_delta' | 'plan_item' | 'procedure_completed'

export interface ToothHistoryEvent {
  type: ToothHistoryEventType
  date: string | null
  summary: string
  /** Visit/encounter + authorship context (present when applicable). */
  visit_id?: string
  encounter_id?: string
  doctor_id?: string
  doctor_name?: string | null
  /** Plan context (plan_item events). */
  plan_id?: string
  plan_item_id?: string | null
  status?: string
  phase?: string | null
  /** Billing context (procedure_completed events). */
  cdt_code?: string | null
  service_id?: string | null
  procedure?: string | null
  surfaces?: string[] | null
  material?: string | null
  billable_amount?: number | null
  cost_estimate?: number | null
  completed_at?: string | null
  /** Raw structured delta (assessment_delta events only). */
  delta?: Record<string, unknown>
}

export interface DentalToothHistory {
  tooth: string
  events: ToothHistoryEvent[]
}
