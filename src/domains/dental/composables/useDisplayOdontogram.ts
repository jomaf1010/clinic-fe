import { computed, type ComputedRef, type Ref } from 'vue'
import { useDentalServices } from './useDentalServices'
import type {
  DentalProfile,
  DentalServiceCatalogEntry,
  DentalTreatmentPlan,
  DentalVisitDetail,
  StampedOdontogram,
  StampedToothState,
  ToothBase,
  ToothSurface,
  TreatmentLineItem,
  TreatmentStatus,
  DentalProcedureLog,
} from '../types/dental.types'

/**
 * Projects the three clinical data sources onto a single per-tooth display
 * state that the chart can render directly. Status is **derived**, never
 * chosen by the user:
 *
 *   - Existing   — leaf `status === 'existing'` on DentalProfile.odontogram
 *   - Proposed   — DentalTreatmentPlan.line_items where status is planned or in_progress
 *   - Completed  — DentalVisit.plan.procedures for the current visit
 *
 * A single tooth commonly carries multiple overlapping layers at different
 * stages (e.g. existing composite on O + proposed crown + completed RCT);
 * all three show simultaneously with different visual styling.
 *
 * This composable is pure-ish: all reactivity flows through the refs you
 * pass in. The service catalog (for CDT code → clinical field mapping) is
 * pulled from `useDentalServices`; callers must have already called
 * `ensureLoaded()` on that composable.
 */

/** The clinical "slot" a display entry represents on a tooth. */
export type ToothField =
  | 'caries' | 'fillings' | 'sealants' | 'crown' | 'endo' | 'post'
  | 'fracture' | 'pulpitis' | 'bruxism' | 'implant' | 'bridge' | 'extraction'

export interface ToothDisplayLayer {
  /** Clinical field this layer paints. */
  field: ToothField
  /** Surface for surface-keyed fields (caries, fillings, sealants). */
  surface?: ToothSurface
  /** Display label (material name, severity, variant, etc.). */
  label: string
  status: TreatmentStatus
  /** Back-link to the plan line item this layer was projected from. */
  plan_item_id?: string | null
  /** Back-link to the visit this layer was recorded on. */
  source_visit_id?: string | null
  /** Back-link to the service catalog entry (when applicable). */
  cdt_code?: string
  recorded_at?: string | null
  recorded_by?: string | null
}

export interface ToothDisplayState {
  fdi: string
  base: ToothBase
  missing: { status: TreatmentStatus; since?: string | null } | null
  layers: ToothDisplayLayer[]
  notes: string | null
}

export type DisplayOdontogram = Record<string, ToothDisplayState>

/** Strip the `t` prefix used on stored FDI keys (see OdontogramMergeService). */
function stripFdiPrefix(fdi: string): string {
  return fdi.startsWith('t') ? fdi.slice(1) : fdi
}

function emptyTooth(fdi: string): ToothDisplayState {
  return { fdi, base: 'tooth', missing: null, layers: [], notes: null }
}

/** Infer the clinical field a service maps onto, based on catalog metadata. */
function fieldForService(service: DentalServiceCatalogEntry | undefined, code: string): ToothField {
  if (!service) {
    // Fallback heuristic from code prefix — survives a missing catalog.
    if (code.startsWith('D21')) return 'fillings'
    if (code.startsWith('D2')) return 'crown'
    if (code.startsWith('D3')) return 'endo'
    if (code.startsWith('D7')) return 'extraction'
    if (code.startsWith('D6')) return 'bridge'
    return 'fillings'
  }
  const name = service.name.toLowerCase()
  switch (service.category) {
    case 'restorative':
      if (service.treatment_area === 'surface') return 'fillings'
      if (name.includes('crown') || name.includes('veneer')) return 'crown'
      return 'fillings'
    case 'endodontic':
      return 'endo'
    case 'surgical':
      return 'extraction'
    case 'prosthodontic':
      if (name.includes('bridge')) return 'bridge'
      // Dentures render to the whole arch, not a single tooth. Route them to
      // bridge so the chart at least gets a tooth-level badge; Phase 6 may
      // introduce an arch-level overlay that handles dentures properly.
      if (name.includes('denture')) return 'bridge'
      return 'crown'
    case 'implant':
      return 'implant'
    case 'preventive':
      return name.includes('sealant') ? 'sealants' : 'fillings'
    default:
      return 'fillings'
  }
}

function layerFromStampedTooth(tooth: StampedToothState): ToothDisplayLayer[] {
  const out: ToothDisplayLayer[] = []

  const surfaceFields: Array<[ToothField, keyof StampedToothState]> = [
    ['caries', 'caries'],
    ['fillings', 'fillings'],
    ['sealants', 'sealants'],
  ]
  for (const [field, key] of surfaceFields) {
    const map = tooth[key] as Record<string, { status?: TreatmentStatus; severity?: string; material?: string; value?: string; source_visit_id?: string | null; recorded_at?: string | null; recorded_by?: string | null }> | undefined
    if (!map) continue
    for (const [surface, leaf] of Object.entries(map)) {
      if (!leaf) continue
      const label = leaf.severity ?? leaf.material ?? leaf.value ?? ''
      out.push({
        field,
        surface: surface as ToothSurface,
        label,
        status: leaf.status ?? 'existing',
        source_visit_id: leaf.source_visit_id ?? null,
        recorded_at: leaf.recorded_at ?? null,
        recorded_by: leaf.recorded_by ?? null,
      })
    }
  }

  const toothFields: Array<[ToothField, keyof StampedToothState, string]> = [
    ['crown', 'crown', 'material'],
    ['endo', 'endo', 'type'],
    ['post', 'post', 'material'],
    ['fracture', 'fracture', 'variant'],
    ['pulpitis', 'pulpitis', ''],
    ['bruxism', 'bruxism', 'variant'],
    ['implant', 'implant', 'stage'],
    ['bridge', 'bridge', 'material'],
  ]
  for (const [field, key, labelKey] of toothFields) {
    const leaf = tooth[key] as { status?: TreatmentStatus; source_visit_id?: string | null; recorded_at?: string | null; recorded_by?: string | null; [k: string]: unknown } | null | undefined
    if (!leaf) continue
    const label = labelKey ? String(leaf[labelKey] ?? '') : ''
    out.push({
      field,
      label,
      status: leaf.status ?? 'existing',
      source_visit_id: leaf.source_visit_id ?? null,
      recorded_at: leaf.recorded_at ?? null,
      recorded_by: leaf.recorded_by ?? null,
    })
  }

  return out
}

function projectPlanItem(
  tooth: ToothDisplayState,
  item: TreatmentLineItem,
  findByCode: (code: string) => DentalServiceCatalogEntry | undefined,
): void {
  const service = findByCode(item.procedure)
  const field = fieldForService(service, item.procedure)
  const label = service?.name ?? item.procedure
  const status: TreatmentStatus = 'proposed'

  if (field === 'fillings' && item.surfaces && item.surfaces.length > 0) {
    for (const surface of item.surfaces) {
      tooth.layers.push({
        field,
        surface,
        label,
        status,
        plan_item_id: item.id,
        cdt_code: item.procedure,
      })
    }
  } else if (field === 'extraction') {
    // Render as proposed-extraction on the tooth so "mark completed" later
    // has the plan_item_id to flip.
    tooth.layers.push({
      field,
      label,
      status,
      plan_item_id: item.id,
      cdt_code: item.procedure,
    })
    tooth.missing = { status: 'proposed' }
  } else {
    tooth.layers.push({
      field,
      label,
      status,
      plan_item_id: item.id,
      cdt_code: item.procedure,
    })
  }
}

function projectProcedure(
  tooth: ToothDisplayState,
  proc: DentalProcedureLog,
  sourceVisitId: string | null,
  findByCode: (code: string) => DentalServiceCatalogEntry | undefined,
): void {
  const code = proc.cdt_code ?? proc.procedure
  const service = findByCode(code)
  const field = fieldForService(service, code)
  const label = service?.name ?? proc.procedure

  if (field === 'fillings' && proc.surfaces && proc.surfaces.length > 0) {
    for (const surface of proc.surfaces) {
      tooth.layers.push({
        field,
        surface,
        label,
        status: 'completed',
        plan_item_id: proc.plan_item_id ?? null,
        source_visit_id: sourceVisitId,
        cdt_code: code,
      })
    }
  } else if (field === 'extraction') {
    // Completed extraction → tooth is now missing, stamped with this visit.
    tooth.missing = { status: 'existing' }
    tooth.layers.push({
      field,
      label,
      status: 'completed',
      plan_item_id: proc.plan_item_id ?? null,
      source_visit_id: sourceVisitId,
      cdt_code: code,
    })
  } else {
    tooth.layers.push({
      field,
      label,
      status: 'completed',
      plan_item_id: proc.plan_item_id ?? null,
      source_visit_id: sourceVisitId,
      cdt_code: code,
    })
  }
}

export function useDisplayOdontogram(
  profile: Ref<DentalProfile | null | undefined>,
  activePlan: Ref<DentalTreatmentPlan | null | undefined>,
  currentVisit: Ref<DentalVisitDetail | null | undefined>,
): { display: ComputedRef<DisplayOdontogram> } {
  const { findByCode } = useDentalServices()

  const display = computed<DisplayOdontogram>(() => {
    const out: DisplayOdontogram = {}

    // Layer 1 — Existing from DentalProfile.odontogram
    const stamped = (profile.value?.odontogram as unknown as StampedOdontogram) ?? {}
    for (const [rawFdi, state] of Object.entries(stamped)) {
      const fdi = stripFdiPrefix(rawFdi)
      const slot = (out[fdi] ??= emptyTooth(fdi))
      if (state.base) slot.base = state.base
      if (state.notes) slot.notes = state.notes
      if (state.missing) {
        slot.missing = {
          status: state.missing.status ?? 'existing',
          since: state.missing.since ?? null,
        }
      }
      slot.layers.push(...layerFromStampedTooth(state))
    }

    // Layer 2 — Proposed (active plan line items)
    for (const item of activePlan.value?.line_items ?? []) {
      if (item.status === 'completed' || item.status === 'cancelled') continue
      for (const fdi of item.teeth ?? []) {
        const slot = (out[fdi] ??= emptyTooth(fdi))
        projectPlanItem(slot, item, findByCode)
      }
    }

    // Layer 3 — Completed (current visit's executed procedures)
    const visitId = currentVisit.value?.id ?? null
    for (const proc of currentVisit.value?.plan?.procedures ?? []) {
      for (const fdi of proc.teeth ?? []) {
        const slot = (out[fdi] ??= emptyTooth(fdi))
        projectProcedure(slot, proc, visitId, findByCode)
      }
    }

    return out
  })

  return { display }
}

// ---- Lower-level export for unit testing without Vue reactivity ----

export function projectDisplayOdontogram(
  profile: DentalProfile | null,
  activePlan: DentalTreatmentPlan | null,
  currentVisit: DentalVisitDetail | null,
  findByCode: (code: string) => DentalServiceCatalogEntry | undefined,
): DisplayOdontogram {
  const out: DisplayOdontogram = {}

  const stamped = (profile?.odontogram as unknown as StampedOdontogram) ?? {}
  for (const [rawFdi, state] of Object.entries(stamped)) {
    const fdi = stripFdiPrefix(rawFdi)
    const slot = (out[fdi] ??= emptyTooth(fdi))
    if (state.base) slot.base = state.base
    if (state.notes) slot.notes = state.notes
    if (state.missing) {
      slot.missing = { status: state.missing.status ?? 'existing', since: state.missing.since ?? null }
    }
    slot.layers.push(...layerFromStampedTooth(state))
  }

  for (const item of activePlan?.line_items ?? []) {
    if (item.status === 'completed' || item.status === 'cancelled') continue
    for (const fdi of item.teeth ?? []) {
      const slot = (out[fdi] ??= emptyTooth(fdi))
      projectPlanItem(slot, item, findByCode)
    }
  }

  const visitId = currentVisit?.id ?? null
  for (const proc of currentVisit?.plan?.procedures ?? []) {
    for (const fdi of proc.teeth ?? []) {
      const slot = (out[fdi] ??= emptyTooth(fdi))
      projectProcedure(slot, proc, visitId, findByCode)
    }
  }

  return out
}
