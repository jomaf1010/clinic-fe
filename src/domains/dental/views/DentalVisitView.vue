<script setup lang="ts">
/**
 * Dental visit form — parallel to PrenatalFormView. Four tabs:
 *   1. Triage      — chief complaint, pain, anxiety, vitals
 *   2. Assessment  — odontogram (delta merged into profile), PSR screening,
 *                    dental findings, diagnoses
 *   3. Plan        — procedures (pulled into Encounter.procedures for billing),
 *                    education, referrals, next-visit recommendation
 *   4. Billing     — reuses PaymentTab + PrescriptionSection + LabOrderSection
 *
 * Layout mirrors the pediatrics / generic consultation view: sticky top header
 * + two-column (3/4 form content, 1/4 summary sidebar) with floating mini tabs.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { HttpError } from '@/lib/http'
import {
  Activity, AlertTriangle, AlertCircle, ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight,
  ChevronsUpDown, ClipboardList, DollarSign, FileText, Heart, HeartPulse, LoaderCircle, Lock,
  Pencil, Pill, Plus, ShieldAlert, Smile, Stamp, Stethoscope, Thermometer, Trash2, Users, Wind,
  type LucideIcon,
} from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Slider } from '@/components/ui/slider'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Combobox, ComboboxAnchor, ComboboxEmpty, ComboboxGroup, ComboboxItem, ComboboxList, ComboboxTrigger,
} from '@/components/ui/combobox'
import ComboboxViewport from '@/components/ui/combobox/ComboboxViewport.vue'
import { ComboboxInput } from 'reka-ui'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useEncounterStore } from '@/domains/encounter/stores/encounterStore'
import { useEncounterSync } from '@/domains/encounter/composables/useEncounterSync'
import { usePatientDetailStore } from '@/stores/patientDetailStore'
import { RouteNames } from '@/router/routeNames'
import DentalChart from '../components/DentalChart.vue'
import ToothEditDialog from '../components/ToothEditDialog.vue'
import DentalToothHistoryDrawer from '../components/DentalToothHistoryDrawer.vue'
import FollowUpScheduler from '@/domains/appointment/components/FollowUpScheduler.vue'
import PsrChart from '../components/PsrChart.vue'
import PerioFullChart from '../components/PerioFullChart.vue'
import DentalChartingPanel from '../components/DentalChartingPanel.vue'
import ToothQuickActions from '../components/ToothQuickActions.vue'
import DmftBadge from '../components/DmftBadge.vue'
import PrescriptionSection from '@/domains/consultation/components/PrescriptionSection.vue'
import LabOrderSection from '@/domains/consultation/components/LabOrderSection.vue'
import PaymentTab from '@/domains/consultation/components/tabs/PaymentTab.vue'
import { toast } from 'vue-sonner'
import type {
  StampedOdontogram, StampedToothState, ToothSurface, PerioPSR, PerioChart,
  DentalProcedureLog, DentalVisitTriage, DentalVisitAssessment, DentalVisitPlan,
  DentalTreatmentPlan, DentalVisitDetail, DentalDiagnosis,
} from '../types/dental.types'
import { useDentalServices } from '../composables/useDentalServices'
import { useDisplayOdontogram } from '../composables/useDisplayOdontogram'
import { useToothNumbering } from '../composables/useToothNumbering'
import { useDentalSessionFindings } from '../composables/useDentalSessionFindings'
import {
  useDentalProcedureSuggestions,
  type ProcedureSuggestion,
} from '../composables/useDentalProcedureSuggestions'
import {
  useDentalDiagnosisSuggestions,
  type DiagnosisSuggestion,
} from '../composables/useDentalDiagnosisSuggestions'
import {
  useDentalAutoCoder,
  familyArea,
  type ProcedureFamily,
  type ProcedureArea,
} from '../composables/useDentalAutoCoder'

// ── Router / stores ─────────────────────────────────────────────────
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useEncounterStore()
const pdStore = usePatientDetailStore()

const encounterId = computed(() => store.current?.id)
const clinicId = computed(() => store.current?.clinic_id)
const { prescriptionUpdate, labOrderUpdate, documentUpdate } = useEncounterSync(encounterId, clinicId)

// ── Permissions ─────────────────────────────────────────────────────
const canEditTriage = computed(() => authStore.hasPermission('encounters.edit-triage'))
const canEditAssessment = computed(() => authStore.hasPermission('encounters.edit-assessment'))
const canEditPlan = computed(() => authStore.hasPermission('encounters.edit-treatment-plan'))
const canFinalize = computed(() => authStore.hasPermission('encounters.finalize'))

const isFinalized = computed(() => store.isFinalized)
const visit = computed(() => store.current?.dental_visit ?? null)
const profile = computed(() => pdStore.dentalProfile)

// ── Tabs (circle stepper) ────────────────────────────────────────────
type TabKey = 'triage' | 'assessment' | 'plan' | 'billing'
const allTabs: TabKey[] = ['triage', 'assessment', 'plan', 'billing']
const tabLabels: Record<TabKey, string> = {
  triage: 'Triage',
  assessment: 'Assessment',
  plan: 'Plan',
  billing: 'Billing',
}
const tabIcons: Record<TabKey, LucideIcon> = {
  triage: Activity,
  assessment: Stethoscope,
  plan: ClipboardList,
  billing: DollarSign,
}
const tabIconsComp: Record<string, Component> = tabIcons as unknown as Record<string, Component>

// ── Local form state — flushed to store.saveSection on blur/save ─────
const activeTab = ref<TabKey>('triage')

const visibleTabs = computed<TabKey[]>(() =>
  allTabs.filter((t) => (t === 'assessment' ? canEditAssessment.value : true)),
)
const currentTabIndex = computed(() => visibleTabs.value.indexOf(activeTab.value))
const prevTabLabel = computed(() => {
  const prev = visibleTabs.value[currentTabIndex.value - 1]
  return prev ? tabLabels[prev] : null
})
const nextTabLabel = computed(() => {
  const next = visibleTabs.value[currentTabIndex.value + 1]
  return next ? tabLabels[next] : null
})
function goToTab(direction: 'prev' | 'next') {
  const idx = currentTabIndex.value + (direction === 'next' ? 1 : -1)
  const t = visibleTabs.value[idx]
  if (t) activeTab.value = t
}
const loadError = ref<string | null>(null)
const showFinalizeModal = ref(false)
const isSavingLocal = ref(false)

// Triage
const chiefComplaint = ref('')
const painScore = ref<number | null>(null)
const anxiety = ref<'' | 'none' | 'mild' | 'moderate' | 'severe'>('')
const triageNotes = ref('')
const bpSystolic = ref<number | null>(null)
const bpDiastolic = ref<number | null>(null)
const hr = ref<number | null>(null)
const temp = ref<number | null>(null)
const spo2 = ref<number | null>(null)

// Assessment — stamped v2 delta keyed by FDI
const odontogramDelta = ref<StampedOdontogram>({})
const perioPsr = ref<PerioPSR>({})
const perioChart = ref<PerioChart>({})
const showFullPerio = ref(false)
const hoveredFdi = ref<number | null>(null)
const dentalFindings = ref('')
const assessmentNotes = ref('')
const diagnosesText = ref('')
// Description → ICD-10 code map. Populated when the dentist taps a
// suggestion in the rail, and on hydrate from any existing diagnoses that
// already carry codes. Lookup happens on save by exact description match —
// editing the description in the textarea drops the code (acceptable
// tradeoff vs the structural rework needed to round-trip codes through a
// freeform textarea).
const diagnosisCodeMap = ref<Record<string, string>>({})

// Perio chart saves are debounced — the user types fast (3 digits per pocket
// across 192 cells), and one request per keystroke creates a race where stale
// responses overwrite newer local state. 600ms is short enough to feel live,
// long enough to coalesce a typed number + a tab-out.
let perioSaveTimer: ReturnType<typeof setTimeout> | null = null
function updatePerioChart(next: PerioChart) {
  perioChart.value = next
  if (perioSaveTimer) clearTimeout(perioSaveTimer)
  perioSaveTimer = setTimeout(() => {
    perioSaveTimer = null
    saveAssessment()
  }, 600)
}

// Quick-actions perio mode emits an updated record for one tooth — splice
// it into the full perio chart map and route through the existing save path.
function onQuickPerioUpdate(record: import('../types/dental.types').PerioToothRecord) {
  if (activeFdi.value == null) return
  updatePerioChart({ ...perioChart.value, [String(activeFdi.value)]: record })
}

// Base change crossed the natural↔implant boundary — drop the perio chart
// entry for this tooth so PD / BOP / mobility-grade values from the prior
// physical structure don't carry over to a different one.
function onClearPerioForTooth(fdi: number) {
  const key = String(fdi)
  if (!(key in perioChart.value)) return
  const next = { ...perioChart.value }
  delete next[key]
  updatePerioChart(next)
}

// Full perio chart's mobility column transitioned across the 0 boundary —
// mirror the change into the per-tooth `mods` list so the SVG painter and
// the sidebar Mobility chip stay in sync.
function onPerioMobilityModChange(fdi: number, present: boolean) {
  const key = String(fdi)
  // Read directly from the merged delta + profile mods map (skipping
  // `renderedStampedOdontogram`'s virtual-mobility injection from
  // `perio_chart`). The injection is exactly the source we're trying to
  // sync FROM — if we read it back we get a stale view because Vue
  // batches computed invalidation until the next flush.
  const profileMods = (profile.value?.odontogram?.[key] as { mods?: Array<{ kind?: string; __remove?: boolean }> } | undefined)?.mods ?? []
  const deltaMods = (odontogramDelta.value[key] as { mods?: Array<{ kind?: string; __remove?: boolean }> } | undefined)?.mods ?? []
  // Last write per kind wins (matches OdontogramMergeService).
  const map = new Map<string, boolean>()
  for (const m of profileMods) if (m.kind) map.set(m.kind, !(m.__remove === true))
  for (const m of deltaMods) if (m.kind) map.set(m.kind, !(m.__remove === true))
  const has = map.get('mobility') === true
  if (has === present) return
  onToothSave(key, {
    mods: [{ kind: 'mobility', ...(present ? {} : { __remove: true }) }] as never,
  })
}

// PaymentTab expects ConsultationAssessment-style diagnoses. Dental now stores
// the same structured shape — pass through but normalise legacy string entries.
const paymentDiagnoses = computed(() => {
  const raw = (visit.value?.assessment?.diagnoses ?? []) as Array<string | DentalDiagnosis>
  return raw.map((d) =>
    typeof d === 'string'
      ? { description: d, code: null, diagnosis_id: null, source: 'manual' as const }
      : { description: d.description, code: d.code ?? null, diagnosis_id: d.diagnosis_id ?? null, source: d.source },
  )
})

// PaymentTab consumes a flat `{service_id, name, quantity, unit_price, notes}`
// shape. Dental procedures are richer (CDT code + teeth + surfaces +
// material), so flatten + fold the qualifiers into the human-readable
// name so the billing breakdown reads naturally:
//   "D2393 Composite filling — #16 MOD · composite"
const paymentProcedures = computed(() => {
  return procedures.value.map((p, i) => {
    const teethLabel = (p.teeth ?? []).map((t) => `#${formatActiveTooth(Number(t))}`).join(', ')
    const surfacesLabel = (p.surfaces ?? []).map((s) => s.charAt(0).toUpperCase()).join('')
    const detailParts = [teethLabel || null, surfacesLabel || null, p.material ?? null]
      .filter(Boolean) as string[]
    const codePrefix = p.cdt_code ? `${p.cdt_code} ` : ''
    const name = detailParts.length > 0
      ? `${codePrefix}${p.procedure} — ${detailParts.join(' · ')}`
      : `${codePrefix}${p.procedure}`
    // Suffix the index when no stable id exists — two auto-coder
    // procedures with the same CDT code on different teeth would
    // otherwise collide on the v-for `:key` in PaymentTab's
    // breakdown and Vue would patch the wrong row.
    const stableId = p.service_id ?? p.id ?? `${p.cdt_code ?? p.procedure}#${i}`
    return {
      service_id: stableId,
      name,
      quantity: 1,
      unit_price: typeof p.billable_amount === 'number' ? p.billable_amount : null,
      notes: p.notes ?? null,
    }
  })
})

// Tooth-edit dialog (opened on demand from sidebar; the chart click only sets active)
const toothDialogOpen = ref(false)
const editingFdi = ref<string | null>(null)
const editingStampedState = ref<StampedToothState | null>(null)

// Active tooth drives the sidebar charting panel + the floating quick-actions
// panel. `quickAnchor` is the cell DOM node we float beside; null when the
// tooth was selected via something other than a chart click (right-click
// menu, keyboard, etc.) — in those cases we focus the sidebar but skip the
// quick panel to avoid stacking floating UIs.
const activeFdi = ref<number | null>(null)
const quickAnchor = ref<HTMLElement | null>(null)
const activeToothState = computed<StampedToothState | null>(() =>
  activeFdi.value != null ? renderedStampedOdontogram.value[String(activeFdi.value)] ?? null : null,
)
const activePerioRecord = computed(() =>
  activeFdi.value != null ? perioChart.value[String(activeFdi.value)] ?? null : null,
)

// Per-tooth history drawer (opens via right-click / secondary action)
const historyDrawerOpen = ref(false)
const historyFdi = ref<string | null>(null)

// Plan
const procedures = ref<DentalProcedureLog[]>([])
const followUpDate = ref<string | null>(null)
const followUpAppointmentId = ref<string | null>(null)

// ── Auto-coder / catalog (CDT-aligned fee schedule) ──────────────────
const { ensureLoaded: loadDentalCatalog, loaded: catalogLoaded } = useDentalServices()
const { resolve: resolveProcedure } = useDentalAutoCoder()

const acFamily = ref<ProcedureFamily>('filling')
const acMaterial = ref<string>('composite')
const acTeeth = ref<Set<number>>(new Set())
const acSurfaces = ref<Set<ToothSurface>>(new Set())
const acArches = ref<Set<'upper' | 'lower'>>(new Set())
const acNotes = ref<string>('')

const acArea = computed<ProcedureArea>(() => familyArea(acFamily.value))

function toggleAcArch(arch: 'upper' | 'lower') {
  const next = new Set(acArches.value)
  next.has(arch) ? next.delete(arch) : next.add(arch)
  acArches.value = next
}

// Family changes can invalidate the current selection (e.g. switching from
// filling → prophy clears teeth & surfaces; → SRP keeps teeth but unfreezes
// multi-select). Reset everything family-driven so the user starts clean.
watch(acFamily, () => {
  acTeeth.value = new Set()
  acSurfaces.value = new Set()
  acArches.value = new Set()
  acNotes.value = ''
})

// FDI arch lists for the picker grid. Chart-mirror layout: each arch shows
// right-quadrant teeth then left-quadrant teeth, reading L→R as the
// dentist faces the patient.
const PERMANENT_UPPER: number[] = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const PERMANENT_LOWER: number[] = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
const PRIMARY_UPPER:   number[] = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65]
const PRIMARY_LOWER:   number[] = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]

// Filters by the same predicate the sidebar uses, so __remove sentinels
// and bare `base: 'tooth'` defaults don't count as findings.
const { findingFdis: sessionFindingFdis } = useDentalSessionFindings(
  odontogramDelta as never,
  perioChart as never,
)

const sessionFindingTeeth = computed<number[]>(() => {
  const order = (fdi: number) => {
    const q = Math.floor(fdi / 10)
    const t = fdi % 10
    if (q === 1 || q === 5) return [0, q, -t] as const
    if (q === 2 || q === 6) return [0, q, t] as const
    if (q === 3 || q === 7) return [1, q, -t] as const
    return [1, q, t] as const
  }
  return Array.from(sessionFindingFdis.value).sort((a, b) => {
    const oa = order(a), ob = order(b)
    return oa[0] - ob[0] || oa[1] - ob[1] || oa[2] - ob[2]
  })
})

// Primary teeth only appear in the dropdowns when there's clinical reason
// — either the session has a primary-tooth finding or the dentist already
// selected one — so the lists stay short for the typical adult workflow.
const showPrimaryGrid = computed(() => {
  const isPrimary = (fdi: number) => {
    const q = Math.floor(fdi / 10)
    return q >= 5 && q <= 8
  }
  for (const fdi of sessionFindingFdis.value) if (isPrimary(fdi)) return true
  for (const fdi of acTeeth.value) if (isPrimary(fdi)) return true
  return false
})

interface ToothOption {
  fdi: number
  /** Stringified for the Select / Combobox model. */
  value: string
  label: string
  isSession: boolean
}

interface ToothOptionGroup {
  label: string
  options: ToothOption[]
}

function makeToothOption(fdi: number): ToothOption {
  return {
    fdi,
    value: String(fdi),
    label: formatActiveTooth(fdi),
    isSession: sessionFindingFdis.value.has(fdi),
  }
}

// Arch-grouped option set used by both the single-tooth Select and the
// multi-tooth Combobox. Session-finding teeth are duplicated into a
// "Session findings" group at the top for one-tap shortcut access.
const toothOptionGroups = computed<ToothOptionGroup[]>(() => {
  const groups: ToothOptionGroup[] = []
  if (sessionFindingTeeth.value.length > 0) {
    groups.push({
      label: 'Session findings',
      options: sessionFindingTeeth.value.map((fdi) => ({
        ...makeToothOption(fdi),
        // Distinct value prefix so the Select / Combobox treats the two
        // appearances as separate items; we strip the prefix on read.
        value: `s:${fdi}`,
      })),
    })
  }
  groups.push({
    label: 'Upper',
    options: PERMANENT_UPPER.map(makeToothOption),
  })
  groups.push({
    label: 'Lower',
    options: PERMANENT_LOWER.map(makeToothOption),
  })
  if (showPrimaryGrid.value) {
    groups.push({
      label: 'Primary upper',
      options: PRIMARY_UPPER.map(makeToothOption),
    })
    groups.push({
      label: 'Primary lower',
      options: PRIMARY_LOWER.map(makeToothOption),
    })
  }
  return groups
})

function valueToFdi(v: string): number {
  return Number(v.startsWith('s:') ? v.slice(2) : v)
}

// Single-tooth Select: model is the first FDI in the set, formatted as a
// plain string. Session-shortcut picks land as `s:16` but the FDI 16 is
// what matters in state.
const acSingleToothValue = computed(() => {
  const first = acTeeth.value.values().next().value
  return first != null ? String(first) : undefined
})

function setSingleTooth(v: string | null | undefined): void {
  if (!v) { acTeeth.value = new Set(); return }
  const fdi = valueToFdi(v)
  if (Number.isFinite(fdi)) acTeeth.value = new Set([fdi])
}

// Multi-tooth Combobox model: array of FDI strings. Session shortcut
// values get collapsed back to plain FDI on read.
const acMultiToothValues = computed(() =>
  Array.from(acTeeth.value).map(String),
)

function setMultiTeeth(arr: string[] | null | undefined): void {
  if (!arr) { acTeeth.value = new Set(); return }
  const next = new Set<number>()
  for (const v of arr) {
    const fdi = valueToFdi(v)
    if (Number.isFinite(fdi)) next.add(fdi)
  }
  acTeeth.value = next
}

// Render the auto-coder labels in the active numbering system. The chip
// picker stores raw FDI numbers internally; only the visible labels flip.
const { numbering, format: formatActiveTooth } = useToothNumbering()
const numberingLabel = computed(() => {
  switch (numbering.value) {
    case 'universal': return 'Universal'
    case 'palmer':    return 'Palmer'
    default:          return 'FDI'
  }
})

function toggleAcSurface(s: ToothSurface) {
  const next = new Set(acSurfaces.value)
  next.has(s) ? next.delete(s) : next.add(s)
  acSurfaces.value = next
}

// Switching procedure family invalidates the previous material selection.
watch(acFamily, (family) => {
  const opts = MATERIAL_OPTIONS[family] ?? []
  acMaterial.value = opts[0]?.value ?? ''
  if (family !== 'filling') acSurfaces.value = new Set()
})

// Selected teeth from the chip picker, sorted in chart order so the
// downstream payload reads top-to-bottom regardless of click sequence.
const acParsedTeeth = computed(() => {
  const order = (fdi: number) => {
    const q = Math.floor(fdi / 10)
    const t = fdi % 10
    if (q === 1 || q === 5) return [0, q, -t] as const
    if (q === 2 || q === 6) return [0, q, t] as const
    if (q === 3 || q === 7) return [1, q, -t] as const
    return [1, q, t] as const
  }
  return Array.from(acTeeth.value)
    .sort((a, b) => {
      const oa = order(a), ob = order(b)
      return oa[0] - ob[0] || oa[1] - ob[1] || oa[2] - ob[2]
    })
    .map(String)
})

interface DraftLine {
  resolved: NonNullable<ReturnType<typeof resolveProcedure>>
  teeth: number[]
  /** Per-line material override. For arch families this is the arch
   *  variant (upper/lower); for everything else it falls back to
   *  `acMaterial`. */
  material?: string
}

// Compute the procedure lines that would be added on Add. Per-area logic:
//   - tooth: one line per selected tooth at full price (codes can differ
//     by tooth class for RCT, but we compute each independently).
//   - quadrant: group selected teeth by quadrant; per-quadrant tooth count
//     picks D4341 (≥4) vs D4342 (1–3). One line per affected quadrant.
//   - arch: one line per selected arch with the arch carrying the material.
//   - full_mouth: one line, no teeth/arches.
const acDraftLines = computed<DraftLine[]>(() => {
  const family = acFamily.value
  const area = acArea.value
  const material = acMaterial.value || undefined
  const surfaces = acSurfaces.value.size > 0 ? Array.from(acSurfaces.value) : undefined
  const lines: DraftLine[] = []

  if (area === 'full_mouth') {
    const r = resolveProcedure({ family, material })
    if (r) lines.push({ resolved: r, teeth: [], material })
    return lines
  }

  if (area === 'arch') {
    // Sort upper before lower so the line list reads top-down.
    const arches = Array.from(acArches.value).sort((a) => (a === 'upper' ? -1 : 1))
    for (const arch of arches) {
      const archMaterial = family === 'denture_complete' ? arch : material
      const r = resolveProcedure({ family, material: archMaterial })
      if (r) lines.push({ resolved: r, teeth: [], material: archMaterial })
    }
    return lines
  }

  if (area === 'tooth') {
    const sorted = Array.from(acTeeth.value).sort((a, b) => a - b)
    for (const t of sorted) {
      const r = resolveProcedure({ family, material, tooth: String(t), surfaces })
      if (r) lines.push({ resolved: r, teeth: [t], material })
    }
    return lines
  }

  // Quadrant
  const byQuadrant = new Map<number, number[]>()
  for (const t of acTeeth.value) {
    const q = Math.floor(t / 10)
    const list = byQuadrant.get(q) ?? []
    list.push(t)
    byQuadrant.set(q, list)
  }
  for (const q of Array.from(byQuadrant.keys()).sort()) {
    const teeth = byQuadrant.get(q)!.sort((a, b) => a - b)
    const srpBracket = teeth.length >= 4 ? '4+' : '1-3'
    const r = resolveProcedure({ family, material, srpBracket })
    if (r) lines.push({ resolved: r, teeth, material })
  }
  return lines
})

const acResolved = computed(() => acDraftLines.value[0]?.resolved)
const acTotal = computed(() =>
  acDraftLines.value.reduce(
    (sum, l) => sum + (l.resolved.clinic_price ?? l.resolved.default_price ?? 0),
    0,
  ),
)

/** Material options shown per family — keeps the dropdown contextual. */
const MATERIAL_OPTIONS: Record<ProcedureFamily, { value: string; label: string }[]> = {
  filling: [
    { value: 'composite', label: 'Composite' },
    { value: 'amalgam', label: 'Amalgam' },
    { value: 'glass_ionomer', label: 'Glass ionomer' },
    { value: 'temporary', label: 'Temporary' },
  ],
  crown: [
    { value: 'pfm', label: 'PFM' },
    { value: 'zircon', label: 'Zirconia' },
    { value: 'emax', label: 'e.max' },
    { value: 'porcelain', label: 'Porcelain' },
    { value: 'metal', label: 'Metal' },
    { value: 'resin', label: 'Resin' },
    { value: 'temporary', label: 'Temporary' },
  ],
  veneer: [
    { value: 'composite', label: 'Composite (direct)' },
    { value: 'porcelain', label: 'Porcelain' },
  ],
  extraction: [
    { value: 'simple', label: 'Simple' },
    { value: 'surgical', label: 'Surgical' },
    { value: 'soft_tissue', label: 'Impacted — soft tissue' },
    { value: 'partial_bony', label: 'Impacted — partial bony' },
    { value: 'complete_bony', label: 'Impacted — complete bony' },
    { value: 'residual_root', label: 'Residual root' },
  ],
  denture_complete: [
    { value: 'upper', label: 'Upper' },
    { value: 'lower', label: 'Lower' },
  ],
  denture_partial: [
    { value: 'acrylic_partial', label: 'Acrylic' },
    { value: 'flexible_partial', label: 'Flexible' },
    { value: 'metal_partial_upper', label: 'Metal frame — upper' },
    { value: 'metal_partial_lower', label: 'Metal frame — lower' },
  ],
  prophy: [
    { value: 'adult', label: 'Adult' },
    { value: 'child', label: 'Child' },
  ],
  rct: [],
  rct_retreatment: [],
  post_core: [],
  fluoride: [],
  sealant: [],
  deep_clean: [],
  srp: [],
  gingivectomy: [],
  bridge_pontic: [],
  implant: [],
  night_guard: [],
}

const FAMILY_OPTIONS: { value: ProcedureFamily; label: string }[] = [
  { value: 'filling', label: 'Filling' },
  { value: 'crown', label: 'Crown' },
  { value: 'veneer', label: 'Veneer' },
  { value: 'rct', label: 'Root canal' },
  { value: 'rct_retreatment', label: 'RCT retreatment' },
  { value: 'post_core', label: 'Post & core' },
  { value: 'extraction', label: 'Extraction' },
  { value: 'prophy', label: 'Prophylaxis' },
  { value: 'fluoride', label: 'Fluoride' },
  { value: 'sealant', label: 'Sealant' },
  { value: 'deep_clean', label: 'Full-mouth debridement' },
  { value: 'srp', label: 'Scaling & root planing' },
  { value: 'denture_complete', label: 'Complete denture' },
  { value: 'denture_partial', label: 'Partial denture' },
  { value: 'bridge_pontic', label: 'Bridge pontic' },
  { value: 'implant', label: 'Implant' },
  { value: 'night_guard', label: 'Night guard' },
]

function familyMaterialOptions(family: ProcedureFamily) {
  return MATERIAL_OPTIONS[family] ?? []
}

// `crypto.randomUUID` is only defined in secure contexts (HTTPS / localhost).
// On plain http://clinic.test it's undefined, so fall back to a non-cryptographic
// id good enough for client-side row keys (UUIDs survive on the server anyway).
function makeLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function addFromAutoCoder() {
  try {
    const lines = acDraftLines.value
    if (lines.length === 0) {
      toast.error('Couldn\'t resolve a code — pick the teeth, arch, or surfaces this procedure needs.')
      return
    }
    // Surfaces apply only to per-tooth filling procedures and persist on
    // each fan-out line (a 3-surface filling on #16 keeps the surfaces
    // metadata so billing/PDF can render "MOD #16" later).
    const surfacesForLine = (line: DraftLine): ToothSurface[] | undefined => {
      if (acArea.value !== 'tooth') return undefined
      if (acFamily.value !== 'filling') return undefined
      if (acSurfaces.value.size === 0) return undefined
      void line
      return Array.from(acSurfaces.value)
    }

    const note = acNotes.value.trim() || null
    const newProcedures = lines.map((l) => ({
      id: makeLocalId(),
      procedure: l.resolved.name,
      cdt_code: l.resolved.cdt_code,
      service_id: l.resolved.clinic_service_uuid ?? undefined,
      teeth: l.teeth.length > 0 ? l.teeth.map(String) : undefined,
      surfaces: surfacesForLine(l),
      material: l.material,
      billable_amount: l.resolved.clinic_price ?? l.resolved.default_price ?? 0,
      // The same note attaches to every fan-out line; the dentist can
      // refine per-line later via Edit if multiple teeth need different
      // captions.
      notes: note,
    }))
    procedures.value = [...procedures.value, ...newProcedures]
    acTeeth.value = new Set()
    acSurfaces.value = new Set()
    acArches.value = new Set()
    acNotes.value = ''
    await savePlan()
  } catch (err) {
    console.error('addFromAutoCoder failed', err)
    toast.error(`Failed to add procedure: ${err instanceof Error ? err.message : 'unknown error'}`)
  }
}

// ── Hydrate local state from server response ─────────────────────────
function hydrateFromVisit() {
  if (!visit.value) return
  const t = visit.value.triage ?? {}
  chiefComplaint.value = t.chief_complaint ?? ''
  painScore.value = t.pain_score ?? null
  anxiety.value = (t.anxiety ?? '') as typeof anxiety.value
  triageNotes.value = t.notes ?? ''
  const v = t.vitals ?? {}
  bpSystolic.value = v.bp_systolic ?? null
  bpDiastolic.value = v.bp_diastolic ?? null
  hr.value = v.hr ?? null
  temp.value = v.temp ?? null
  spo2.value = v.spo2 ?? null

  const a = visit.value.assessment ?? {}
  const rawDelta = a.odontogram_delta
  odontogramDelta.value = (rawDelta && typeof rawDelta === 'object' && !Array.isArray(rawDelta)
    ? rawDelta
    : {}) as StampedOdontogram
  perioPsr.value = (a.perio_psr ?? {}) as PerioPSR
  const rawChart = a.perio_chart
  perioChart.value = (rawChart && typeof rawChart === 'object' && !Array.isArray(rawChart)
    ? rawChart
    : {}) as PerioChart
  if (Object.keys(perioChart.value).length > 0) showFullPerio.value = true
  dentalFindings.value = a.dental_findings ?? ''
  assessmentNotes.value = a.notes ?? ''
  // Diagnoses come back from the encounter API as structured objects;
  // legacy data may still be strings. Flatten either shape to one
  // description per textarea line.
  const rawDiagnoses = (a.diagnoses ?? []) as Array<string | DentalDiagnosis>
  const codeMap: Record<string, string> = {}
  diagnosesText.value = rawDiagnoses
    .map((d) => {
      if (typeof d === 'string') return d
      const desc = d.description ?? ''
      if (desc && d.code) codeMap[desc] = d.code
      return desc
    })
    .filter(Boolean)
    .join('\n')
  diagnosisCodeMap.value = codeMap

  const p = visit.value.plan ?? {}
  procedures.value = (p.procedures ?? []) as DentalProcedureLog[]
  followUpDate.value = p.follow_up ?? null
  followUpAppointmentId.value = p.follow_up_appointment_id ?? null
}

// Hydrate only when the encounter identity changes — server replies to a
// PATCH save shouldn't reset local refs (the local IS what we just sent;
// the server reply often arrives mid-keystroke and would silently drop
// in-progress edits to the diagnoses textarea or odontogramDelta).
const hydratedEncounterUuid = ref<string | null>(null)
watch(
  visit,
  (v) => {
    const id = (v as { uuid?: string } | null)?.uuid ?? null
    if (id !== null && id === hydratedEncounterUuid.value) return
    hydratedEncounterUuid.value = id
    hydrateFromVisit()
  },
  { immediate: true },
)

// Apply a stamped delta to a base tooth, honouring `{ __remove: true }`
// sentinels at every leaf the same way the backend OdontogramMergeService
// does. Without this, toggling a field off locally would still show the
// field as set (because the sentinel object itself is truthy).
function isRemoveLeaf(v: unknown): boolean {
  return !!(v && typeof v === 'object' && (v as Record<string, unknown>).__remove === true)
}

function mergeToothDelta(base: StampedToothState, delta: Partial<StampedToothState>): StampedToothState {
  const out: Record<string, unknown> = { ...base }
  const SURFACE_FIELDS = ['caries', 'fillings', 'sealants'] as const
  const SCALAR_FIELDS = ['crown', 'endo', 'post', 'fracture', 'pulpitis', 'bruxism', 'implant', 'bridge', 'missing'] as const

  for (const f of SURFACE_FIELDS) {
    const incoming = (delta as Record<string, unknown>)[f] as Record<string, unknown> | undefined
    if (!incoming) continue
    // Field-level `{ __remove: true }` wipes the entire surface map
    // (e.g. extraction clearing all caries on the tooth in one shot).
    // Without this, the sentinel was being interpreted as a surface
    // called "__remove" and the existing surfaces were never cleared.
    if (isRemoveLeaf(incoming)) {
      delete out[f]
      continue
    }
    const baseSurfaces = ((base as Record<string, unknown>)[f] as Record<string, unknown> | undefined) ?? {}
    const next: Record<string, unknown> = { ...baseSurfaces }
    for (const [surf, leaf] of Object.entries(incoming)) {
      if (surf === '__remove') continue
      if (isRemoveLeaf(leaf)) {
        delete next[surf]
      } else {
        next[surf] = leaf
      }
    }
    if (Object.keys(next).length === 0) {
      delete out[f]
    } else {
      out[f] = next
    }
  }

  for (const f of SCALAR_FIELDS) {
    if (!(f in (delta as Record<string, unknown>))) continue
    const v = (delta as Record<string, unknown>)[f]
    if (v == null || isRemoveLeaf(v)) {
      delete out[f]
    } else {
      out[f] = v
    }
  }

  // Mods / specials are list-toggles by `kind`. Incoming entries with
  // `__remove: true` drop the matching kind from base; others add/replace.
  for (const f of ['mods', 'specials'] as const) {
    const incoming = (delta as Record<string, unknown>)[f] as Array<Record<string, unknown>> | undefined
    if (!incoming) continue
    const baseList = ((base as Record<string, unknown>)[f] as Array<Record<string, unknown>> | undefined) ?? []
    const map = new Map<string, Record<string, unknown>>()
    for (const e of baseList) map.set(String(e.kind), e)
    for (const e of incoming) {
      const kind = String(e.kind)
      if (e.__remove) map.delete(kind)
      else map.set(kind, e)
    }
    if (map.size === 0) delete out[f]
    else out[f] = Array.from(map.values())
  }

  // Plain scalars
  if ('base' in (delta as Record<string, unknown>)) {
    const v = (delta as Record<string, unknown>).base
    if (v) out.base = v
  }
  if ('notes' in (delta as Record<string, unknown>)) {
    const v = (delta as Record<string, unknown>).notes
    if (v == null || v === '') delete out.notes
    else out.notes = v
  }

  return out as StampedToothState
}

const renderedStampedOdontogram = computed<StampedOdontogram>(() => {
  const base = (profile.value?.odontogram ?? {}) as StampedOdontogram
  const merged: StampedOdontogram = { ...base }
  for (const [fdi, partial] of Object.entries(odontogramDelta.value)) {
    merged[fdi] = mergeToothDelta((base[fdi] ?? {}) as StampedToothState, partial as Partial<StampedToothState>)
  }
  // Virtual mobility sync — if `perio_chart[fdi].mobility > 0` but the
  // tooth has no `mobility` mod, inject one so every consumer (SVG painter,
  // sidebar Mobility chip, perio dot tooltip) shows the tooth as mobile
  // without having to dirty the visit. Legacy data that pre-dates the sync
  // wiring lands here and renders correctly.
  for (const [rawFdi, rec] of Object.entries(perioChart.value ?? {})) {
    if (!rec || (rec.mobility ?? 0) <= 0) continue
    const fdi = rawFdi.startsWith('t') ? rawFdi.slice(1) : rawFdi
    const tooth = merged[fdi] ?? {}
    const mods = tooth.mods ?? []
    if (mods.some((m) => m.kind === 'mobility')) continue
    merged[fdi] = {
      ...tooth,
      mods: [
        ...mods,
        { kind: 'mobility', status: 'existing', source_visit_id: null, recorded_at: null, recorded_by: null },
      ],
    }
  }
  return merged
})

const projectedProfile = computed(() => {
  if (!profile.value) return null
  return { ...profile.value, odontogram: renderedStampedOdontogram.value } as typeof profile.value
})

// Suggested ICD-10 diagnoses derived from the merged odontogram + perio
// chart. Filters out anything whose description already appears in the
// textarea so the rail is always "things you haven't accepted yet".
const rawDiagnosisSuggestions = useDentalDiagnosisSuggestions(
  renderedStampedOdontogram,
  perioChart,
  perioPsr,
)
const diagnosisSuggestions = computed<DiagnosisSuggestion[]>(() => {
  const existing = new Set(
    diagnosesText.value.split('\n').map((s) => s.trim()).filter(Boolean),
  )
  return rawDiagnosisSuggestions.value.filter((s) => !existing.has(s.description))
})

function acceptDiagnosisSuggestion(s: DiagnosisSuggestion) {
  if (!canEditAssessment.value || isFinalized.value) return
  // Append on a new line; trim trailing whitespace first to avoid blank gaps.
  const cur = diagnosesText.value.replace(/\s+$/, '')
  diagnosesText.value = cur ? `${cur}\n${s.description}` : s.description
  diagnosisCodeMap.value = { ...diagnosisCodeMap.value, [s.description]: s.code }
  saveAssessment()
}

// ── Procedure suggestions (Plan tab) ─────────────────────────────────
// Same shape as the diagnosis rail: chip per suggestion, tap to accept.
// Suggestions either pre-fill the auto-coder form (filling/crown/SRP that
// still need material/scope decisions) or auto-add directly (RCT,
// extraction, prophy, night guard — fully resolvable with no further
// dentist input). Filtered to hide already-added matches so the rail
// shrinks as the dentist works through it.
const { suggestions: rawProcedureSuggestions } = useDentalProcedureSuggestions(
  renderedStampedOdontogram,
  perioChart,
  perioPsr,
)
const procedureSuggestions = computed<ProcedureSuggestion[]>(() => {
  const existing = new Set<string>()
  for (const p of procedures.value) {
    // Match on family + tooth list to avoid offering the same procedure
    // again. Family+teeth is the closest thing to a stable identity for
    // an in-progress draft.
    const teethKey = (p.teeth ?? []).slice().sort().join(',')
    const family = (p as { family?: string }).family ?? p.cdt_code ?? p.procedure
    existing.add(`${family}|${teethKey}`)
  }
  return rawProcedureSuggestions.value.filter((s) => {
    const teethKey = (s.prefill.teeth ?? []).slice().sort().join(',')
    return !existing.has(`${s.family}|${teethKey}`)
      && !existing.has(`${s.code}|${teethKey}`)
  })
})

async function acceptProcedureSuggestion(s: ProcedureSuggestion) {
  if (!canEditPlan.value || isFinalized.value) return
  // Family change triggers the watcher that resets teeth/surfaces/arches,
  // so set family first, await the reactive flush, then load the rest of
  // the prefill payload.
  acFamily.value = s.prefill.family
  await nextTick()
  if (s.prefill.material !== undefined) acMaterial.value = s.prefill.material
  acTeeth.value = new Set(s.prefill.teeth ?? [])
  acSurfaces.value = new Set(s.prefill.surfaces ?? [])
  acArches.value = new Set(s.prefill.arches ?? [])

  if (!s.canAutoAdd) return
  // Wait one more tick so acDraftLines recomputes from the new state.
  await nextTick()
  await addFromAutoCoder()
}

const activeTreatmentPlan = computed<DentalTreatmentPlan | null>(
  () => pdStore.dentalTreatmentPlans.find((p) => p.status === 'active') ?? null,
)

const currentVisitDetail = computed<DentalVisitDetail | null>(
  () => (visit.value ?? null) as DentalVisitDetail | null,
)

const { display: displayOdontogram } = useDisplayOdontogram(
  projectedProfile,
  activeTreatmentPlan,
  currentVisitDetail,
)

// ── Save handlers ────────────────────────────────────────────────────
async function saveTriage() {
  if (!canEditTriage.value || isFinalized.value) return
  const payload: { triage: DentalVisitTriage } = {
    triage: {
      chief_complaint: chiefComplaint.value || null,
      pain_score: painScore.value,
      anxiety: anxiety.value || null,
      notes: triageNotes.value || null,
      vitals: {
        bp_systolic: bpSystolic.value,
        bp_diastolic: bpDiastolic.value,
        hr: hr.value,
        temp: temp.value,
        spo2: spo2.value,
      },
    },
  }
  isSavingLocal.value = true
  try {
    await store.saveSection(payload)
  } finally {
    isSavingLocal.value = false
  }
}

async function saveAssessment() {
  if (!canEditAssessment.value || isFinalized.value) return
  // Encounter API expects structured diagnoses ({description, source, ...}).
  // Dental UI keeps them as plain text in a textarea; wrap each line so the
  // request validator accepts the payload.
  const lines = diagnosesText.value
    .split('\n').map((s) => s.trim()).filter(Boolean)
  const diagnoses: DentalDiagnosis[] = lines.map((description) => {
    const code = diagnosisCodeMap.value[description] ?? null
    return {
      description,
      code,
      diagnosis_id: null,
      source: code ? 'icd' : 'manual',
    }
  })

  // Prune the code map to only keys that still exist in the textarea —
  // editing a description after accepting a suggestion used to leave a
  // stale entry behind, which could later auto-attach the old code to a
  // different (but identically-worded) line. Plus the map otherwise
  // grows unbounded across a long charting session.
  const stillPresent = new Set(lines)
  diagnosisCodeMap.value = Object.fromEntries(
    Object.entries(diagnosisCodeMap.value).filter(([k]) => stillPresent.has(k)),
  )

  const payload: { assessment: DentalVisitAssessment } = {
    assessment: {
      odontogram_delta: odontogramDelta.value,
      perio_psr: perioPsr.value,
      perio_chart: Object.keys(perioChart.value).length > 0 ? perioChart.value : null,
      dental_findings: dentalFindings.value || null,
      diagnoses,
      notes: assessmentNotes.value || null,
    },
  }
  isSavingLocal.value = true
  try {
    await store.saveSection(payload)
  } finally {
    isSavingLocal.value = false
  }
}

async function savePlan() {
  if (!canEditPlan.value || isFinalized.value) return
  const payload: { plan: DentalVisitPlan } = {
    plan: {
      procedures: procedures.value,
      follow_up: followUpDate.value,
      follow_up_appointment_id: followUpAppointmentId.value,
    },
  }
  isSavingLocal.value = true
  try {
    await store.saveSection(payload)
  } finally {
    isSavingLocal.value = false
  }
}

// ── Tooth selection / dialog ─────────────────────────────────────────
function selectTooth(fdi: number | string, anchor?: HTMLElement | null) {
  // Chart click → sidebar focuses this tooth and the quick-actions panel
  // anchors next to the cell. Clicking the same tooth again closes both.
  const next = Number(fdi)
  if (activeFdi.value === next) {
    activeFdi.value = null
    quickAnchor.value = null
    return
  }
  activeFdi.value = next
  quickAnchor.value = anchor ?? null
}

// Sidebar "session findings" rows are clickable on every tab the panel is
// mounted on. On the assessment tab clicking a row simply focuses the tooth
// for inline charting; on plan/billing we jump back to assessment so the
// dentist can act on the finding without losing context.
function onSidebarSelectTooth(fdi: number) {
  if (activeTab.value !== 'assessment') {
    activeTab.value = 'assessment'
  }
  selectTooth(fdi)
}

function closeQuickActions() {
  // Triggered by the panel's click-outside / × button. Keeps the sidebar
  // focused on the same tooth — only the floating UI dismisses.
  quickAnchor.value = null
}

function openDetailDialog() {
  if (activeFdi.value == null) return
  const key = String(activeFdi.value)
  editingFdi.value = key
  editingStampedState.value = (renderedStampedOdontogram.value[key] ?? null) as StampedToothState | null
  toothDialogOpen.value = true
}

function onToothSave(fdi: string, toothDelta: Partial<StampedToothState>) {
  const existing = (odontogramDelta.value[fdi] ?? {}) as StampedToothState
  // Surface-keyed fields (caries / fillings / sealants) and list fields
  // (mods / specials) need a *deep* merge so successive single-surface
  // toggles accumulate instead of overwriting each other. Scalar fields use
  // shallow replacement, which is what the rest of `...existing, ...delta`
  // would have done anyway.
  const next: Record<string, unknown> = { ...existing }
  for (const [k, v] of Object.entries(toothDelta as Record<string, unknown>)) {
    if (k === 'caries' || k === 'fillings' || k === 'sealants') {
      const baseMap = (existing as Record<string, unknown>)[k] as Record<string, unknown> | undefined
      next[k] = { ...(baseMap ?? {}), ...(v as Record<string, unknown>) }
    } else if (k === 'mods' || k === 'specials') {
      // Dedupe by `kind` — successive toggles of the same kind must collapse,
      // otherwise the delta accumulates duplicate entries that surface as
      // repeated chips in the session summary (mergeToothDelta dedupes on
      // the render path, but the raw delta is the source for the summary).
      const baseList = ((existing as Record<string, unknown>)[k] as Array<Record<string, unknown>> | undefined) ?? []
      const incoming = (v as Array<Record<string, unknown>> | undefined) ?? []
      const map = new Map<string, Record<string, unknown>>()
      for (const e of baseList) if (e?.kind != null) map.set(String(e.kind), e)
      for (const e of incoming) {
        if (e?.kind == null) continue
        if (e.__remove) map.set(String(e.kind), { kind: e.kind, __remove: true })
        else map.set(String(e.kind), e)
      }
      next[k] = Array.from(map.values())
    } else {
      next[k] = v
    }
  }
  odontogramDelta.value = {
    ...odontogramDelta.value,
    [fdi]: next as StampedToothState,
  }

  // Bidirectional mobility sync — when a write touches `mods.mobility`,
  // mirror it into `perio_chart[fdi].mobility` so the full perio chart and
  // quick-actions perio mode never diverge from the sidebar / context menu.
  const incomingMods = (toothDelta as { mods?: Array<{ kind?: string; __remove?: boolean }> }).mods
  const mobilityEntry = incomingMods?.find((m) => m?.kind === 'mobility')
  if (mobilityEntry) {
    const removing = mobilityEntry.__remove === true
    const curRec = perioChart.value[fdi]
    const curGrade = curRec?.mobility ?? 0
    if (removing && curGrade > 0) {
      const updated = curRec ?? defaultPerioRecord()
      updatePerioChart({ ...perioChart.value, [fdi]: { ...updated, mobility: 0 } })
    } else if (!removing && curGrade === 0) {
      const updated = curRec ?? defaultPerioRecord()
      updatePerioChart({ ...perioChart.value, [fdi]: { ...updated, mobility: 1 } })
    }
  }

  saveAssessment()
}

function defaultPerioRecord(): import('../types/dental.types').PerioToothRecord {
  return {
    facial: [{ pd: null, bop: false }, { pd: null, bop: false }, { pd: null, bop: false }],
    lingual: [{ pd: null, bop: false }, { pd: null, bop: false }, { pd: null, bop: false }],
    mobility: 0,
  }
}

// Charting-panel emits an incremental delta — same merge semantics as the dialog.
function onChartingApply(delta: Partial<StampedToothState>) {
  if (activeFdi.value == null) return
  onToothSave(String(activeFdi.value), delta)
}

// Right-click context menu on a tooth in the chart — bypasses activeFdi
// because the menu carries its own fdi (the tooth that was right-clicked).
function onChartContextApply(fdi: number, delta: Partial<StampedToothState>) {
  onToothSave(String(fdi), delta)
}
function onChartContextReset(fdi: number) {
  activeFdi.value = fdi
  onChartingReset()
}
function onChartContextOpenDetail(fdi: number) {
  activeFdi.value = fdi
  openDetailDialog()
}

function onChartingReset() {
  if (activeFdi.value == null) return
  const fdi = String(activeFdi.value)
  // Clear every clinical leaf via __remove sentinels. Backend merger drops
  // each one. (Intentionally aggressive — playground "reset tooth" parity.)
  const existing = renderedStampedOdontogram.value[fdi]
  if (!existing) return
  const wipe: Record<string, unknown> = {}
  if (existing.caries) wipe.caries = Object.fromEntries(Object.keys(existing.caries).map((s) => [s, { __remove: true }]))
  if (existing.fillings) wipe.fillings = Object.fromEntries(Object.keys(existing.fillings).map((s) => [s, { __remove: true }]))
  if (existing.sealants) wipe.sealants = Object.fromEntries(Object.keys(existing.sealants).map((s) => [s, { __remove: true }]))
  if (existing.crown) wipe.crown = { __remove: true }
  if (existing.endo) wipe.endo = { __remove: true }
  if (existing.post) wipe.post = { __remove: true }
  if (existing.fracture) wipe.fracture = { __remove: true }
  if (existing.pulpitis) wipe.pulpitis = { __remove: true }
  if (existing.bruxism) wipe.bruxism = { __remove: true }
  if (existing.implant) wipe.implant = { __remove: true }
  if (existing.bridge) wipe.bridge = { __remove: true }
  if (existing.missing) wipe.missing = { __remove: true }
  if (existing.mods?.length) wipe.mods = existing.mods.map((m) => ({ kind: m.kind, __remove: true }))
  if (existing.specials?.length) wipe.specials = existing.specials.map((s) => ({ kind: s.kind, __remove: true }))
  if (existing.notes) wipe.notes = null
  onToothSave(fdi, wipe as Partial<StampedToothState>)
}

/** Hook for Phase 10 — right-click / long-press on a tooth opens the drawer. */
function _openToothHistory(fdi: number) {
  historyFdi.value = String(fdi)
  historyDrawerOpen.value = true
}
void _openToothHistory

// ── Procedure helpers ────────────────────────────────────────────────
function removeProcedure(idx: number) {
  procedures.value = procedures.value.filter((_, i) => i !== idx)
  savePlan()
}

// ── Edit a procedure line ────────────────────────────────────────────
// Opens a dialog with editable fields for an existing entry. Procedure
// name + CDT code stay read-only — changing those should mean deleting
// and re-adding so the catalog code-resolution stays the source of truth
// for pricing and billing-shape.
//
// State mirrors the Add form's pattern (direct Set refs, not a draft
// object) so the multi-tooth picker and surface chips bind reactively
// the same way. The draft only holds non-collection fields (notes,
// billable_amount) plus the read-only header info.
const editingProcedureIdx = ref<number | null>(null)
const editingProcedureDraft = ref<DentalProcedureLog | null>(null)
const editTeeth = ref<Set<number>>(new Set())
const editSurfaces = ref<Set<ToothSurface>>(new Set())

function startEditProcedure(idx: number) {
  if (isFinalized.value || !canEditPlan.value) return
  const proc = procedures.value[idx]
  if (!proc) return
  editingProcedureIdx.value = idx
  // Deep clone so the draft can be edited freely and discarded on cancel.
  editingProcedureDraft.value = {
    ...proc,
    teeth: proc.teeth ? [...proc.teeth] : undefined,
    surfaces: proc.surfaces ? [...proc.surfaces] : undefined,
  }
  // Hydrate the picker state from the procedure's persisted FDI strings
  // and surface labels.
  const teethSet = new Set<number>()
  for (const t of proc.teeth ?? []) {
    const n = Number(t)
    if (Number.isFinite(n)) teethSet.add(n)
  }
  editTeeth.value = teethSet
  editSurfaces.value = new Set(proc.surfaces ?? [])
}

function cancelEditProcedure() {
  editingProcedureIdx.value = null
  editingProcedureDraft.value = null
  editTeeth.value = new Set()
  editSurfaces.value = new Set()
}

function toggleEditTooth(fdi: number) {
  const next = new Set(editTeeth.value)
  next.has(fdi) ? next.delete(fdi) : next.add(fdi)
  editTeeth.value = next
}

function setEditTooth(v: string | null | undefined) {
  if (!v) { editTeeth.value = new Set(); return }
  const fdi = valueToFdi(v)
  if (Number.isFinite(fdi)) editTeeth.value = new Set([fdi])
}

function setEditTeethMulti(arr: string[] | null | undefined) {
  if (!arr) { editTeeth.value = new Set(); return }
  const next = new Set<number>()
  for (const v of arr) {
    const fdi = valueToFdi(v)
    if (Number.isFinite(fdi)) next.add(fdi)
  }
  editTeeth.value = next
}

function toggleEditSurface(s: ToothSurface) {
  const next = new Set(editSurfaces.value)
  next.has(s) ? next.delete(s) : next.add(s)
  editSurfaces.value = next
}

// Surfaces only matter for surface-driven CDT codes (fillings, sealants).
// Detect via the procedure's family — same code-prefix logic the
// procedure→delta bridge uses on the backend.
const editIsSurfaceProc = computed(() => {
  const code = editingProcedureDraft.value?.cdt_code ?? ''
  if (!code) return false
  if (/^D2(140|150|160|161|330|331|332|335|391|392|393|394)$/.test(code)) return true
  if (code === 'D2330-GIC') return true
  if (code === 'D1351') return true
  return false
})

// Multi-tooth (quadrant area: D4341/D4342, D4210). Otherwise single-tooth.
const editIsMultiTooth = computed(() => {
  const code = editingProcedureDraft.value?.cdt_code ?? ''
  if (!code) return false
  if (/^D434(1|2)$/.test(code)) return true
  if (code === 'D4210') return true
  return false
})

const editTeethValues = computed(() => Array.from(editTeeth.value).map(String))
const editSingleToothValue = computed(() => {
  const first = editTeeth.value.values().next().value
  return first != null ? String(first) : undefined
})

async function saveEditProcedure() {
  const idx = editingProcedureIdx.value
  const draft = editingProcedureDraft.value
  if (idx == null || !draft) return

  const teeth = Array.from(editTeeth.value).sort((a, b) => a - b).map(String)
  const surfaces = editIsSurfaceProc.value && editSurfaces.value.size > 0
    ? Array.from(editSurfaces.value)
    : undefined

  procedures.value = procedures.value.map((p, i) => {
    if (i !== idx) return p
    return {
      ...draft,
      teeth: teeth.length > 0 ? teeth : undefined,
      surfaces,
      billable_amount: draft.billable_amount == null || isNaN(Number(draft.billable_amount))
        ? null
        : Number(draft.billable_amount),
      notes: draft.notes && draft.notes.trim() !== '' ? draft.notes : null,
    }
  })

  cancelEditProcedure()
  await savePlan()
}

// ── Treatment plan link ──────────────────────────────────────────────
async function linkTreatmentPlan(planId: string | null) {
  if (isFinalized.value) return
  await store.saveSection({ treatment_plan_id: planId })
}

// ── Finalize ─────────────────────────────────────────────────────────
async function onFinalize() {
  await store.finalize()
  showFinalizeModal.value = false
  if (store.current?.status === 'finalized') {
    toast.success('Visit finalized')
  }
}

// ── Sidebar data ────────────────────────────────────────────────────
const patientInitials = computed(() => {
  const p = pdStore.patient
  if (!p) return '?'
  return `${p.first_name?.charAt(0) ?? ''}${p.last_name?.charAt(0) ?? ''}`.toUpperCase()
})

const activeProblems = computed(() => pdStore.problems.filter((p) => p.status !== 'resolved').slice(0, 5))
const activeAllergies = computed(() => pdStore.allergies.slice(0, 5))
const activeMedications = computed(() => pdStore.medications.filter((m) => m.status === 'active').slice(0, 5))
const familyHistoryEntries = computed(() => pdStore.familyHistory.slice(0, 5))

const lifestyleSummary = computed(() => {
  const ls = pdStore.lifestyle
  if (!ls) return []
  const items: { label: string; value: string }[] = []
  if (ls.smoking) items.push({ label: 'Smoking', value: ls.smoking })
  if (ls.alcohol) items.push({ label: 'Alcohol', value: ls.alcohol })
  if (ls.exercise) items.push({ label: 'Exercise', value: ls.exercise })
  if (ls.diet) items.push({ label: 'Diet', value: ls.diet })
  return items
})

const recentDentalVisits = computed(() =>
  pdStore.dentalVisits
    .filter((v) => v.id !== store.current?.id)
    .slice(0, 3),
)

const currentVitals = computed(() => {
  const v = visit.value?.triage?.vitals
  if (!v) return null
  const hasAny = Object.values(v).some((x) => x != null)
  return hasAny ? v : null
})

const painLabel = computed(() => {
  const score = painScore.value
  if (score === null || score === 0) return null
  if (score <= 3) return { label: 'Mild', color: 'text-green-600' }
  if (score <= 6) return { label: 'Moderate', color: 'text-amber-600' }
  return { label: 'Severe', color: 'text-red-600' }
})

function onPainScoreChange(val: number[] | undefined) {
  painScore.value = val?.[0] ?? null
  saveTriage()
}

const psrSummary = computed(() => {
  if (!profile.value?.perio_psr) return null
  const codes = Object.values(profile.value.perio_psr).filter((c): c is number => typeof c === 'number')
  if (codes.length === 0) return null
  return { max: Math.max(...codes), count: codes.length }
})

const clinicalSummary = computed<string | null>(() => {
  const lines: string[] = []
  const problems = pdStore.problems.filter((p) => p.status !== 'resolved')
  const meds = pdStore.medications.filter((m) => m.status === 'active')
  const allergies = pdStore.allergies
  const ls = pdStore.lifestyle
  const b = (t: string | number) => `<b>${t}</b>`

  if (problems.length) {
    const top = problems.slice(0, 3).map((p) => b(p.description)).join(', ')
    const more = problems.length > 3 ? ` (+${problems.length - 3} more)` : ''
    lines.push(`Active conditions: ${top}${more}.`)
  }
  if (meds.length) {
    lines.push(`On ${b(meds.length + ' active medication' + (meds.length > 1 ? 's' : ''))}.`)
  }
  if (allergies.length) {
    const names = allergies.slice(0, 3).map((a) => b(a.allergen)).join(', ')
    lines.push(`Allergic to ${names}.`)
  }
  if (ls?.smoking && ls.smoking !== 'never') {
    lines.push(`${b(ls.smoking + ' smoker')}.`)
  }
  return lines.length ? lines.join(' ') : null
})

function formatVisitDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Mini floating tabs (IntersectionObserver on the stepper) ─────────
const stepperRef = ref<HTMLElement | null>(null)
const formScrollRef = ref<HTMLElement | null>(null)
const showMiniTabs = ref(false)
let tabsObserver: IntersectionObserver | null = null

function setupTabsObserver() {
  setTimeout(() => {
    const stepperEl = stepperRef.value
    const scrollEl = formScrollRef.value
    if (!stepperEl || !scrollEl) return
    tabsObserver = new IntersectionObserver(
      ([entry]) => { showMiniTabs.value = !entry!.isIntersecting },
      { root: scrollEl, threshold: 0 },
    )
    tabsObserver.observe(stepperEl)
  }, 300)
}

// ── Bootstrap ────────────────────────────────────────────────────────
onMounted(async () => {
  loadError.value = null
  loadDentalCatalog().catch(() => { /* billing tab surfaces the error if any */ })
  try {
    if (route.name === RouteNames.ENCOUNTER_NEW) {
      const patientId = route.params.patientId as string
      const created = await store.createForPatient(patientId, 'default', { encounterType: 'dental' })
      await router.replace({ name: RouteNames.ENCOUNTER_DETAIL, params: { patientId, id: created.id } })
    } else {
      const id = route.params.id as string
      if (!store.current || store.current.id !== id) {
        await store.loadEncounter(id)
      }
    }
    const pid = store.current?.patient_id
    if (pid) {
      await pdStore.loadPatient(pid)
      pdStore.loadDental()
      // Sidebar data — patient-level, shared with consultation view
      pdStore.loadCore()
      if (!pdStore.lifestyle && !pdStore.medications.length && !pdStore.familyHistory.length) {
        pdStore.loadFM()
      }
    }
  } catch (err) {
    if (err instanceof HttpError && err.status === 403) {
      loadError.value = "You don't have permission to access this visit."
    } else {
      loadError.value = 'Failed to load dental visit.'
    }
  }
  setupTabsObserver()
})

onUnmounted(() => {
  tabsObserver?.disconnect()
  tabsObserver = null
  // Flush any pending perio save so the last keystroke isn't dropped.
  if (perioSaveTimer) {
    clearTimeout(perioSaveTimer)
    perioSaveTimer = null
    saveAssessment()
  }
})

function goBack() {
  if (store.current?.patient_id) {
    router.push({ name: RouteNames.PATIENT_DETAIL, params: { id: store.current.patient_id } })
  } else {
    router.back()
  }
}
</script>

<template>
  <div v-if="store.isLoading && !store.current" class="flex flex-1 items-center justify-center py-12">
    <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
  </div>

  <div
    v-else-if="loadError"
    role="alert"
    class="mx-auto max-w-md rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
  >
    {{ loadError }}
  </div>

  <Tabs
    v-else-if="store.current"
    v-model="activeTab"
    class="-mx-4 -mb-4 flex min-h-0 flex-1 flex-col overflow-hidden"
  >
    <!-- Sticky patient header + actions -->
    <div class="sticky top-0 z-10 border-b bg-background">
      <div class="flex flex-col gap-2 px-4 pb-1 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <!-- Left: back + patient name + status -->
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" class="gap-1.5" @click="goBack">
            <ArrowLeft class="size-3.5" />
            {{ pdStore.patient?.full_name ?? 'Dental visit' }}
          </Button>
          <Badge variant="secondary">Dental</Badge>
          <Badge
            v-if="!isFinalized"
            class="border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
            variant="outline"
          >
            Draft
          </Badge>
          <Badge
            v-else
            class="border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400"
            variant="outline"
          >
            <CheckCircle2 class="size-3" /> Finalized
          </Badge>
        </div>

        <!-- Right: DMFT + finalize -->
        <div class="flex items-center gap-2">
          <DmftBadge
            v-if="profile"
            :score="profile.dmft_score"
            :decayed="profile.dmft_decayed"
            :missing="profile.dmft_missing"
            :filled="profile.dmft_filled"
            :primary-score="profile.dmft_score_primary"
          />
          <Button
            v-if="canFinalize && !isFinalized"
            size="sm"
            :disabled="isSavingLocal"
            @click="showFinalizeModal = true"
          >
            <CheckCircle2 class="size-3.5" /> Finalize
          </Button>
        </div>
      </div>
    </div>

    <!-- Two-column layout -->
    <div class="relative flex min-h-0 flex-1 flex-col lg:flex-row">

      <!-- Floating mini tabs -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div v-if="showMiniTabs" class="pointer-events-none absolute inset-x-0 top-2 z-30 flex lg:pr-[25%]">
          <div class="pointer-events-auto mx-auto flex items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow-md backdrop-blur">
            <button
              v-for="tab in visibleTabs"
              :key="tab"
              type="button"
              class="flex h-7 items-center justify-center rounded-full px-2 text-[10px] font-medium uppercase tracking-wide transition-all duration-200"
              :class="activeTab === tab
                ? 'gap-1.5 bg-primary text-primary-foreground min-w-[5rem]'
                : 'gap-0 text-muted-foreground hover:bg-muted size-7 min-w-7 max-w-7 px-0'"
              @click="activeTab = tab"
            >
              <component :is="tabIconsComp[tab]" class="size-3.5 shrink-0" />
              <span
                class="overflow-hidden whitespace-nowrap transition-all duration-200"
                :class="activeTab === tab ? 'max-w-[5rem] opacity-100' : 'max-w-0 opacity-0'"
              >{{ tabLabels[tab] }}</span>
            </button>
          </div>
        </div>
      </Transition>

      <!-- Left: Form content -->
      <div ref="formScrollRef" class="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-4 pt-0 md:px-6 md:pb-8 lg:w-3/4">
        <!-- Hidden TabsList for reka-ui a11y -->
        <TabsList class="sr-only">
          <TabsTrigger v-for="tab in visibleTabs" :key="tab" :value="tab">{{ tabLabels[tab] }}</TabsTrigger>
        </TabsList>

        <!-- Circle stepper -->
        <div ref="stepperRef" class="mb-5 py-3">
          <div class="relative mx-0 md:mx-8">
            <div class="absolute top-5 right-5 left-5 h-0.5 bg-border">
              <div
                class="absolute inset-y-0 left-0 bg-primary/40 transition-all duration-500"
                :style="{ width: `${visibleTabs.length > 1 ? (currentTabIndex / (visibleTabs.length - 1)) * 100 : 0}%` }"
              />
            </div>
            <div class="relative flex justify-between">
              <button
                v-for="(tab, i) in visibleTabs"
                :key="tab"
                type="button"
                class="group flex flex-col items-center gap-1.5"
                @click="activeTab = tab"
              >
                <div
                  class="flex size-10 items-center justify-center rounded-full border-2 transition-all duration-300"
                  :class="
                    activeTab === tab
                      ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110'
                      : currentTabIndex > i
                        ? 'border-primary bg-background text-primary hover:scale-105 scale-100'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground hover:scale-105 scale-100'
                  "
                >
                  <component :is="tabIcons[tab]" class="size-4" />
                </div>
                <span
                  class="text-xs font-semibold uppercase tracking-wide transition-colors duration-200"
                  :class="activeTab === tab ? 'text-primary' : 'text-muted-foreground'"
                >
                  {{ tabLabels[tab] }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Read-only banner -->
        <div
          v-if="isFinalized"
          class="mb-3 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground"
        >
          <Lock class="size-3.5 shrink-0" />
          This visit has been finalized and is read-only.
        </div>

        <!-- ───── Triage ───── -->
        <TabsContent value="triage" class="mt-0 flex flex-col divide-y divide-dashed divide-border px-0 md:px-8 [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">

          <!-- Chief Complaint -->
          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Chief Complaint</h3>
            <Textarea
              id="cc"
              v-model="chiefComplaint"
              :disabled="isFinalized || !canEditTriage"
              rows="3"
              placeholder="e.g. Pain on upper right molar, 2 days"
              @blur="saveTriage"
            />
          </div>

          <!-- Vitals -->
          <div>
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Vitals</h3>
            <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div class="flex flex-col gap-2">
                <Label class="flex items-center gap-1.5">
                  <HeartPulse class="size-3.5 text-muted-foreground" />
                  Blood Pressure (mmHg)
                </Label>
                <div class="flex items-center gap-2">
                  <Input
                    v-model.number="bpSystolic"
                    type="number"
                    min="50"
                    max="250"
                    placeholder="Systolic"
                    :disabled="isFinalized || !canEditTriage"
                    @blur="saveTriage"
                  />
                  <span class="text-xs text-muted-foreground">/</span>
                  <Input
                    v-model.number="bpDiastolic"
                    type="number"
                    min="30"
                    max="150"
                    placeholder="Diastolic"
                    :disabled="isFinalized || !canEditTriage"
                    @blur="saveTriage"
                  />
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <Label class="flex items-center gap-1.5">
                  <Activity class="size-3.5 text-muted-foreground" />
                  Heart Rate (bpm)
                </Label>
                <Input
                  v-model.number="hr"
                  type="number"
                  min="20"
                  max="300"
                  placeholder="72"
                  :disabled="isFinalized || !canEditTriage"
                  @blur="saveTriage"
                />
              </div>

              <div class="flex flex-col gap-2">
                <Label class="flex items-center gap-1.5">
                  <Thermometer class="size-3.5 text-muted-foreground" />
                  Temperature (°C)
                </Label>
                <Input
                  v-model.number="temp"
                  type="number"
                  step="0.1"
                  min="30"
                  max="45"
                  placeholder="36.8"
                  :disabled="isFinalized || !canEditTriage"
                  @blur="saveTriage"
                />
              </div>

              <div class="flex flex-col gap-2">
                <Label class="flex items-center gap-1.5">
                  <Wind class="size-3.5 text-muted-foreground" />
                  SpO₂ (%)
                </Label>
                <Input
                  v-model.number="spo2"
                  type="number"
                  min="50"
                  max="100"
                  placeholder="98"
                  :disabled="isFinalized || !canEditTriage"
                  @blur="saveTriage"
                />
              </div>
            </div>
          </div>

          <!-- Pain & Anxiety -->
          <div>
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pain &amp; Anxiety</h3>
            <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
              <div class="flex flex-col gap-2">
                <div class="flex h-6 items-center">
                  <Label class="flex items-center gap-1.5">
                    <Activity class="size-3.5 text-muted-foreground" />
                    Pain Score
                    <span v-if="painScore !== null" class="ml-1 font-mono text-base font-semibold">
                      {{ painScore }}/10
                    </span>
                    <span v-if="painLabel" :class="painLabel.color" class="text-xs font-medium">
                      ({{ painLabel.label }})
                    </span>
                  </Label>
                </div>
                <Slider
                  :model-value="[painScore ?? 0]"
                  :min="0"
                  :max="10"
                  :step="1"
                  :disabled="isFinalized || !canEditTriage"
                  class="mt-2.5 w-full"
                  @update:model-value="onPainScoreChange"
                />
                <div class="flex justify-between text-[10px] text-muted-foreground">
                  <span>0 - No pain</span>
                  <span>10 - Worst pain</span>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <div class="flex h-6 items-center">
                  <Label class="flex items-center gap-1.5">
                    <Smile class="size-3.5 text-muted-foreground" />
                    Anxiety Level
                  </Label>
                </div>
                <Select
                  :model-value="anxiety || undefined"
                  :disabled="isFinalized || !canEditTriage"
                  @update:model-value="(v) => { anxiety = (v ?? '') as typeof anxiety; saveTriage() }"
                >
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="Select anxiety level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <!-- Lab Orders — same affordance as the FM triage. The dentist
               often wants to send the patient to the lab (CBC pre-extraction,
               INR for anticoagulated patients, etc.) at intake, not after
               the chart has been worked through. -->
          <div v-if="encounterId" class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lab Orders</h3>
            <LabOrderSection
              :encounter-id="encounterId"
              :disabled="isFinalized || !canEditTriage"
              :realtime-update="labOrderUpdate"
            />
          </div>

          <!-- Triage Notes -->
          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Triage Notes</h3>
            <Textarea
              v-model="triageNotes"
              :disabled="isFinalized || !canEditTriage"
              rows="3"
              placeholder="Additional triage notes..."
              @blur="saveTriage"
            />
          </div>

          <!-- Nav -->
          <div class="flex justify-end">
            <Button v-if="nextTabLabel" variant="outline" @click="goToTab('next')">
              {{ nextTabLabel }} <ChevronRight class="ml-1 size-4" />
            </Button>
          </div>
        </TabsContent>

        <!-- ───── Assessment ───── -->
        <TabsContent value="assessment" class="mt-0 flex flex-col divide-y divide-dashed divide-border px-0 md:px-8 [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">

          <!-- Odontogram -->
          <div>
            <div class="mb-3 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Odontogram</h3>
                <p class="mt-1 text-xs text-muted-foreground">Click a tooth to edit its clinical state.</p>
              </div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-card">
              <DentalChart
                :display="displayOdontogram"
                :stamped="renderedStampedOdontogram"
                :perio-chart="perioChart"
                :active-fdi="activeFdi"
                :context-menu-disabled="isFinalized || !canEditAssessment"
                @select-tooth="selectTooth"
                @hover-tooth="hoveredFdi = $event"
                @apply-tooth="onChartContextApply"
                @reset-tooth="onChartContextReset"
                @open-detail="onChartContextOpenDetail"
                @clear-perio="onClearPerioForTooth"
              />
            </div>
          </div>

          <!-- Floating quick-actions panel — caries wheel + context bar.
               Mounted only when an active tooth has been picked from a chart
               click (anchor exists). Right-click selections leave the anchor
               null and skip this panel so context-menu + quick-panel don't
               stack on top of each other. -->
          <ToothQuickActions
            v-if="activeFdi != null && quickAnchor"
            :fdi="activeFdi"
            :state="activeToothState"
            :perio-record="activePerioRecord"
            :anchor="quickAnchor"
            :disabled="isFinalized || !canEditAssessment"
            @apply="onChartingApply"
            @update-perio="onQuickPerioUpdate"
            @close="closeQuickActions"
          />

          <!-- Periodontal Screening -->
          <div>
            <div class="mb-3 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Periodontal Screening</h3>
                <p class="mt-1 text-xs text-muted-foreground">
                  Quick PSR by sextant. Code ≥3 suggests a full work-up.
                </p>
              </div>
              <button
                type="button"
                class="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                @click="showFullPerio = !showFullPerio"
              >
                {{ showFullPerio ? 'Hide full chart' : 'Open full chart' }}
              </button>
            </div>
            <div class="mt-2 space-y-4">
              <PsrChart
                v-model="perioPsr"
                :active-fdi="activeFdi"
                :hovered-fdi="hoveredFdi"
                @update:model-value="saveAssessment"
              />
              <PerioFullChart
                v-if="showFullPerio"
                :model-value="perioChart"
                :stamped="renderedStampedOdontogram"
                :active-fdi="activeFdi"
                :hovered-fdi="hoveredFdi"
                :disabled="isFinalized || !canEditAssessment"
                @update:model-value="updatePerioChart"
                @update:hovered-fdi="hoveredFdi = $event"
                @mobility-mod-change="onPerioMobilityModChange"
              />
            </div>
          </div>

          <!-- Findings — explicitly NOT per-tooth. Soft tissue, occlusion,
               TMJ, habits, halitosis, generalised findings that have no
               natural home in the odontogram or perio chart. -->
          <div class="flex flex-col gap-2">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Soft-tissue &amp; General Findings
              </h3>
              <p class="text-[11px] leading-snug text-muted-foreground/80">
                Not for per-tooth findings — use the chart for those. Use this for
                gingiva, mucosa, tongue, occlusion, TMJ, habits, hygiene status, etc.
              </p>
            </div>
            <Textarea
              v-model="dentalFindings"
              :disabled="isFinalized || !canEditAssessment"
              rows="3"
              placeholder="Generalised gingivitis lower anteriors. Calculus on lingual #31–41. No mucosal lesions. Class I occlusion. No TMJ tenderness."
              @blur="saveAssessment"
            />
          </div>

          <!-- Diagnoses -->
          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Diagnoses</h3>

            <!-- Suggestion rail — derived from chart + perio; tap to accept.
                 Hidden when the assessment yields no findings to suggest, so
                 the section stays quiet on uneventful visits. -->
            <div
              v-if="diagnosisSuggestions.length > 0 && !isFinalized && canEditAssessment"
              class="flex flex-col gap-1"
            >
              <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                Suggested · tap to accept
              </p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="s in diagnosisSuggestions"
                  :key="s.id"
                  type="button"
                  class="group inline-flex items-center gap-1.5 rounded-full border border-blue-300/70 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-900 transition hover:border-blue-500 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:border-blue-400 dark:hover:bg-blue-500/20"
                  :title="s.teeth?.length ? `Teeth: ${s.teeth.join(', ')}` : undefined"
                  @click="acceptDiagnosisSuggestion(s)"
                >
                  <span class="rounded bg-blue-200/70 px-1 font-mono text-[10px] font-bold uppercase tracking-wide text-blue-900 dark:bg-blue-500/30 dark:text-blue-100">
                    {{ s.code }}
                  </span>
                  <span class="text-left">{{ s.description }}</span>
                  <span class="ml-0.5 text-blue-500 opacity-60 transition group-hover:opacity-100">+</span>
                </button>
              </div>
            </div>

            <Textarea
              v-model="diagnosesText"
              :disabled="isFinalized || !canEditAssessment"
              rows="3"
              placeholder="One per line — e.g. Irreversible pulpitis, tooth #16&#10;Chronic generalized periodontitis"
              @blur="saveAssessment"
            />
          </div>

          <!-- Notes -->
          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Assessment Notes</h3>
            <Textarea
              v-model="assessmentNotes"
              :disabled="isFinalized || !canEditAssessment"
              rows="3"
              placeholder="Additional assessment notes..."
              @blur="saveAssessment"
            />
          </div>

          <!-- Nav -->
          <div class="flex justify-between">
            <Button v-if="prevTabLabel" variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" /> {{ prevTabLabel }}
            </Button>
            <span v-else />
            <Button v-if="nextTabLabel" variant="outline" @click="goToTab('next')">
              {{ nextTabLabel }} <ChevronRight class="ml-1 size-4" />
            </Button>
          </div>
        </TabsContent>

        <!-- ───── Plan ───── -->
        <TabsContent value="plan" class="mt-0 flex flex-col divide-y divide-dashed divide-border px-0 md:px-8 [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">

          <!-- Linked Treatment Plan — only when at least one plan exists. -->
          <div v-if="pdStore.dentalTreatmentPlans.length > 0" class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Linked Treatment Plan</h3>
            <p class="text-xs text-muted-foreground">
              Bind this visit to a multi-visit treatment plan, or leave standalone.
            </p>
            <Select
              :model-value="visit?.treatment_plan_id ?? '__standalone__'"
              :disabled="isFinalized"
              @update:model-value="(v) => linkTreatmentPlan(v === '__standalone__' ? null : (v as string))"
            >
              <SelectTrigger class="mt-1 w-full sm:max-w-md">
                <SelectValue placeholder="Select treatment plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__standalone__">— Standalone visit —</SelectItem>
                <SelectItem v-for="p in pdStore.dentalTreatmentPlans" :key="p.id" :value="p.id">
                  {{ p.chief_complaint || 'Plan' }} ({{ p.status }})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Procedures performed this visit -->
          <div class="flex flex-col gap-3">
            <div>
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Procedures</h3>
              <p class="mt-1 text-xs text-muted-foreground">
                Treatment performed today. Each entry feeds the invoice on the Billing tab.
              </p>
            </div>

            <p v-if="procedures.length === 0" class="text-xs text-muted-foreground">No procedures yet.</p>
            <ul v-else class="divide-y rounded-lg border bg-card">
              <li v-for="(proc, i) in procedures" :key="proc.id ?? i" class="flex items-start gap-2 px-3 py-2">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium">{{ proc.procedure }}</p>
                  <p v-if="proc.teeth?.length" class="text-xs text-muted-foreground">Teeth: {{ proc.teeth.join(', ') }}</p>
                  <p v-if="proc.notes" class="text-xs text-muted-foreground">{{ proc.notes }}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-semibold tabular-nums">₱{{ (proc.billable_amount ?? 0).toFixed(2) }}</p>
                </div>
                <Button v-if="!isFinalized" variant="ghost" size="icon" :aria-label="`Edit ${proc.procedure}`" @click="startEditProcedure(i)">
                  <Pencil class="size-4" />
                </Button>
                <Button v-if="!isFinalized" variant="ghost" size="icon" :aria-label="`Remove ${proc.procedure}`" @click="removeProcedure(i)">
                  <Trash2 class="size-4" />
                </Button>
              </li>
            </ul>

            <!-- Suggested procedures rail — hidden on finalized visits or
                 when there's nothing to recommend yet. Tap a chip to either
                 auto-add (lightning bolt = no further input needed) or
                 pre-fill the form below for the dentist to finish picking
                 material / surfaces / scope. -->
            <div
              v-if="procedureSuggestions.length > 0 && !isFinalized && canEditPlan"
              class="flex flex-col gap-1"
            >
              <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
                Suggested · tap to {{ procedureSuggestions.some((s) => s.canAutoAdd) ? 'add or pre-fill' : 'pre-fill' }}
              </p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="s in procedureSuggestions"
                  :key="s.id"
                  type="button"
                  class="group inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium transition focus:outline-none focus:ring-2"
                  :class="s.canAutoAdd
                    ? 'border-emerald-300/70 bg-emerald-50 text-emerald-900 hover:border-emerald-500 hover:bg-emerald-100 focus:ring-emerald-300 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:border-emerald-400 dark:hover:bg-emerald-500/20'
                    : 'border-blue-300/70 bg-blue-50 text-blue-900 hover:border-blue-500 hover:bg-blue-100 focus:ring-blue-300 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:border-blue-400 dark:hover:bg-blue-500/20'"
                  :title="s.reason + (s.canAutoAdd ? ' · adds immediately' : ' · pre-fills the form')"
                  @click="acceptProcedureSuggestion(s)"
                >
                  <span
                    v-if="s.code"
                    class="rounded px-1 font-mono text-[10px] font-bold uppercase tracking-wide"
                    :class="s.canAutoAdd
                      ? 'bg-emerald-200/70 text-emerald-900 dark:bg-emerald-500/30 dark:text-emerald-100'
                      : 'bg-blue-200/70 text-blue-900 dark:bg-blue-500/30 dark:text-blue-100'"
                  >{{ s.code }}</span>
                  <span class="text-left">{{ s.label }}</span>
                  <span v-if="s.price != null" class="font-mono tabular-nums opacity-70">
                    ₱{{ s.price.toFixed(0) }}
                  </span>
                  <span class="ml-0.5 opacity-60 transition group-hover:opacity-100">
                    {{ s.canAutoAdd ? '⚡' : '+' }}
                  </span>
                </button>
              </div>
            </div>

            <div v-if="!isFinalized && canEditPlan" class="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/30 p-3">
              <div class="flex items-center justify-between">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Add procedure</p>
                <span v-if="!catalogLoaded" class="text-[10px] text-muted-foreground">Loading fee schedule…</span>
              </div>

              <div class="grid grid-cols-1 gap-2 sm:grid-cols-12">
                <div :class="acArea !== 'arch' && familyMaterialOptions(acFamily).length > 0 ? 'sm:col-span-7' : 'sm:col-span-12'">
                  <Label class="text-xs">Procedure</Label>
                  <Select
                    :model-value="acFamily"
                    @update:model-value="(v) => { if (v) acFamily = v as ProcedureFamily }"
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="Select procedure" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="f in FAMILY_OPTIONS" :key="f.value" :value="f.value">
                        {{ f.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- Material variant — hidden for arch families because the
                     arch picker below drives the variant for dentures. -->
                <div v-if="acArea !== 'arch' && familyMaterialOptions(acFamily).length > 0" class="sm:col-span-5">
                  <Label class="text-xs">Material / variant</Label>
                  <Select
                    :model-value="acMaterial"
                    @update:model-value="(v) => { if (v) acMaterial = v as string }"
                  >
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="m in familyMaterialOptions(acFamily)" :key="m.value" :value="m.value">
                        {{ m.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <!-- Single-tooth picker (per-tooth families). Session findings
                   appear as a dedicated group at the top for fast access; the
                   rest of the dropdown is arch-ordered. -->
              <div v-if="acArea === 'tooth'" class="flex flex-col gap-2">
                <Label class="text-xs">Tooth ({{ numberingLabel }})</Label>
                <Select
                  :model-value="acSingleToothValue"
                  @update:model-value="(v) => setSingleTooth(v)"
                >
                  <SelectTrigger class="w-full sm:max-w-md">
                    <SelectValue :placeholder="`Select tooth (${numberingLabel})`" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup
                      v-for="g in toothOptionGroups"
                      :key="g.label"
                    >
                      <SelectLabel>{{ g.label }}</SelectLabel>
                      <SelectItem v-for="opt in g.options" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <!-- Multi-tooth picker (quadrant families: SRP, gingivectomy).
                   Combobox supports search by typing the tooth label. -->
              <div v-else-if="acArea === 'quadrant'" class="flex flex-col gap-2">
                <div class="flex items-baseline justify-between">
                  <Label class="text-xs">Teeth ({{ numberingLabel }})</Label>
                  <span v-if="acTeeth.size > 0" class="text-[10px] text-muted-foreground">
                    {{ acTeeth.size }} selected
                  </span>
                </div>
                <Combobox
                  :model-value="acMultiToothValues"
                  multiple
                  @update:model-value="(v: unknown) => setMultiTeeth(v as string[] | null)"
                >
                  <ComboboxAnchor as-child>
                    <div class="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs sm:max-w-md">
                      <ComboboxInput
                        :placeholder="acTeeth.size > 0 ? `${acTeeth.size} selected — search teeth…` : `Search teeth (${numberingLabel})`"
                        class="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      />
                      <ComboboxTrigger class="shrink-0">
                        <ChevronsUpDown class="size-4 text-muted-foreground" />
                      </ComboboxTrigger>
                    </div>
                  </ComboboxAnchor>
                  <ComboboxList class="w-(--reka-combobox-trigger-width) p-1">
                    <ComboboxViewport class="max-h-[260px]">
                      <ComboboxEmpty class="px-2 py-1.5 text-center text-sm text-muted-foreground">No match</ComboboxEmpty>
                      <ComboboxGroup
                        v-for="g in toothOptionGroups"
                        :key="g.label"
                      >
                        <div class="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {{ g.label }}
                        </div>
                        <ComboboxItem
                          v-for="opt in g.options"
                          :key="opt.value"
                          :value="opt.value"
                          class="flex items-center gap-2 px-2 py-1.5"
                        >
                          <span class="flex size-4 shrink-0 items-center justify-center">
                            <Check v-if="acTeeth.has(opt.fdi)" class="size-4" />
                          </span>
                          {{ opt.label }}
                        </ComboboxItem>
                      </ComboboxGroup>
                    </ComboboxViewport>
                  </ComboboxList>
                </Combobox>
              </div>

              <!-- Arch picker — for complete dentures. Multi-select so an
                   upper + lower set can be added in one click; each arch
                   becomes its own line at full price. -->
              <div v-else-if="acArea === 'arch'" class="flex flex-col gap-2">
                <Label class="text-xs">Arch</Label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="arch in (['upper', 'lower'] as const)"
                    :key="arch"
                    type="button"
                    :aria-pressed="acArches.has(arch)"
                    class="rounded-md border px-4 py-2 text-sm font-medium capitalize transition-colors"
                    :class="acArches.has(arch) ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted'"
                    @click="toggleAcArch(arch)"
                  >{{ arch }} arch</button>
                </div>
              </div>

              <!-- Surfaces — only meaningful for per-tooth fillings. -->
              <div v-if="acArea === 'tooth' && acFamily === 'filling'" class="flex flex-wrap gap-2">
                <Label class="w-full text-xs">Surfaces</Label>
                <button
                  v-for="s in (['mesial','occlusal','distal','buccal','lingual','incisal'] as ToothSurface[])"
                  :key="s"
                  type="button"
                  class="rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors"
                  :class="acSurfaces.has(s) ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted'"
                  @click="toggleAcSurface(s)"
                >
                  {{ s.charAt(0).toUpperCase() }} · {{ s }}
                </button>
              </div>

              <!-- Optional notes — applied to every line on fan-out. -->
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs">Notes (optional)</Label>
                <Textarea
                  v-model="acNotes"
                  rows="2"
                  placeholder="e.g. Anaesthesia required, post-op care discussed…"
                />
              </div>

              <!-- Resolved preview — list one row per draft line so a
                   multi-tooth or multi-quadrant fan-out shows every CDT
                   code + price the dentist is about to commit, plus a
                   total. Single line collapses to the single-row card. -->
              <div v-if="acDraftLines.length > 0" class="flex flex-col gap-1.5">
                <div class="flex flex-col gap-1 rounded-md border bg-background">
                  <div
                    v-for="(line, i) in acDraftLines"
                    :key="`${line.resolved.cdt_code}-${i}`"
                    class="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    :class="i > 0 ? 'border-t' : ''"
                  >
                    <div class="flex min-w-0 items-center gap-2">
                      <span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-muted-foreground">
                        {{ line.resolved.cdt_code }}
                      </span>
                      <span class="truncate">{{ line.resolved.name }}</span>
                      <span v-if="line.teeth.length > 0" class="shrink-0 text-[10px] text-muted-foreground">
                        · {{ line.teeth.map((t) => formatActiveTooth(t)).join(', ') }}
                      </span>
                    </div>
                    <span class="shrink-0 font-semibold tabular-nums">₱{{ (line.resolved.clinic_price ?? line.resolved.default_price ?? 0).toFixed(2) }}</span>
                  </div>
                  <div v-if="acDraftLines.length > 1" class="flex items-center justify-between border-t bg-muted/40 px-3 py-1.5 text-xs">
                    <span class="font-medium uppercase tracking-wide text-muted-foreground">Total · {{ acDraftLines.length }} lines</span>
                    <span class="font-semibold tabular-nums">₱{{ acTotal.toFixed(2) }}</span>
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p v-if="acDraftLines.length === 0" class="flex-1 text-[11px] text-muted-foreground">
                  <template v-if="acArea === 'tooth' && acFamily === 'filling' && acSurfaces.size === 0">
                    Tap a tooth and at least one surface to resolve a code.
                  </template>
                  <template v-else-if="acArea === 'tooth' && (acFamily === 'rct' || acFamily === 'rct_retreatment')">
                    Pick a tooth — RCT pricing depends on tooth type.
                  </template>
                  <template v-else-if="acArea === 'tooth'">
                    Tap a tooth to add this procedure.
                  </template>
                  <template v-else-if="acArea === 'quadrant'">
                    Tap teeth across one or more quadrants to add this procedure.
                  </template>
                  <template v-else-if="acArea === 'arch'">
                    Pick the upper or lower arch (or both) to add a denture line.
                  </template>
                  <template v-else>
                    Couldn't resolve a code for this procedure — check the catalog.
                  </template>
                </p>
                <span v-else class="flex-1" />

                <Button class="sm:w-auto" :disabled="acDraftLines.length === 0" @click="addFromAutoCoder">
                  <Plus class="size-4 mr-1" />
                  Add{{ acDraftLines.length > 1 ? ` (${acDraftLines.length})` : '' }}
                </Button>
              </div>
            </div>
          </div>

          <!-- Prescriptions -->
          <div v-if="encounterId" class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Prescriptions</h3>
            <PrescriptionSection
              :encounter-id="encounterId"
              :disabled="isFinalized || !canEditPlan"
              :realtime-update="prescriptionUpdate"
              :document-update="documentUpdate"
            />
          </div>

          <!-- Lab Orders -->
          <div v-if="encounterId" class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lab Orders</h3>
            <LabOrderSection
              :encounter-id="encounterId"
              :disabled="isFinalized || !canEditPlan"
              :realtime-update="labOrderUpdate"
            />
          </div>

          <!-- Follow-up booking — replaces the old free-text recommendation
               with a real scheduled appointment so the dentist's "come back
               in 2 weeks" lands on the calendar instead of the textarea.
               Doctor + patient ids come from the encounter (the embedded
               dental_visit summary doesn't carry them). -->
          <div v-if="store.current?.doctor_id && store.current?.patient_id" class="flex flex-col gap-3">
            <div>
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Follow-up</h3>
              <p class="mt-1 text-xs text-muted-foreground">
                Pick a date and time-slot for the patient's next visit. An appointment is created on book and unbinds on clear.
              </p>
            </div>
            <FollowUpScheduler
              :doctor-id="store.current.doctor_id"
              :patient-id="store.current.patient_id"
              :follow-up="followUpDate"
              :follow-up-appointment-id="followUpAppointmentId"
              :disabled="isFinalized || !canEditPlan"
              @update:booking="(b: { followUp: string | null; appointmentId: string | null }) => {
                followUpDate = b.followUp
                followUpAppointmentId = b.appointmentId
                savePlan()
              }"
            />
          </div>

          <!-- Nav -->
          <div class="flex justify-between">
            <Button v-if="prevTabLabel" variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" /> {{ prevTabLabel }}
            </Button>
            <span v-else />
            <Button v-if="nextTabLabel" variant="outline" @click="goToTab('next')">
              {{ nextTabLabel }} <ChevronRight class="ml-1 size-4" />
            </Button>
          </div>
        </TabsContent>

        <!-- ───── Billing ───── -->
        <TabsContent value="billing" class="mt-0 space-y-3 px-0 md:px-8">
          <PaymentTab
            v-if="store.current"
            :disabled="isFinalized"
            :encounter-id="store.current.id"
            :status="store.current.status"
            :consultation-type="'default'"
            :patient-id="store.current.patient_id"
            :diagnoses="paymentDiagnoses"
            :document-update="documentUpdate"
            :consumables="store.current.consumables ?? []"
            :procedures="paymentProcedures"
            :prescription-summary="store.current.prescription_summary"
            :lab-order-summary="store.current.lab_order_summary"
            :payment="store.current.payment"
            :can-finalize="!isFinalized && canFinalize"
            :is-saving="isSavingLocal || store.isSaving"
            @update:payment="(p) => { if (store.current) store.current.payment = p }"
            @finalize="showFinalizeModal = true"
          />
          <div class="flex justify-between">
            <Button v-if="prevTabLabel" variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" /> {{ prevTabLabel }}
            </Button>
            <span v-else />
            <Button v-if="canFinalize && !isFinalized" @click="showFinalizeModal = true">Finalize visit</Button>
          </div>
        </TabsContent>
      </div>

      <!-- Right: Sidebar — charting tools while assessing, session findings
           recap on the plan tab, patient summary on the rest. -->
      <aside class="hidden min-h-0 overflow-y-auto border-l px-4 pb-4 pt-3 lg:block lg:w-1/4">
        <DentalChartingPanel
          v-if="activeTab === 'assessment' || activeTab === 'plan'"
          :fdi="activeTab === 'plan' ? null : activeFdi"
          :state="activeTab === 'plan' ? null : activeToothState"
          :session-delta="odontogramDelta"
          :perio-chart="perioChart"
          :procedures="procedures"
          :disabled="activeTab === 'plan' || isFinalized || !canEditAssessment"
          @apply="onChartingApply"
          @reset-tooth="onChartingReset"
          @open-detail="openDetailDialog"
          @select-tooth="onSidebarSelectTooth"
          @clear-perio="onClearPerioForTooth"
        />
        <div v-else class="flex flex-col gap-3">

          <!-- Patient Card -->
          <div v-if="pdStore.patient" class="flex flex-col gap-3 rounded-xl border bg-card p-3">
            <div class="flex items-center gap-3">
              <Avatar class="size-10">
                <AvatarImage v-if="pdStore.patient.avatar_url" :src="pdStore.patient.avatar_url" :alt="pdStore.patient.full_name" />
                <AvatarFallback class="bg-gradient-to-br from-sky-500 to-cyan-500 text-sm font-semibold text-white">
                  {{ patientInitials }}
                </AvatarFallback>
              </Avatar>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-bold leading-tight">{{ pdStore.patient.full_name }}</p>
                <div class="flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                  <span v-if="pdStore.patientAge !== null">{{ pdStore.patientAge }} yrs</span>
                  <span v-if="pdStore.patient.sex">&middot; {{ pdStore.patient.sex === 'female' ? 'F' : pdStore.patient.sex === 'male' ? 'M' : pdStore.patient.sex }}</span>
                  <span v-if="pdStore.patient.blood_type">&middot; {{ pdStore.patient.blood_type }}</span>
                </div>
              </div>
            </div>
            <Badge variant="secondary" class="w-fit text-[10px]">Dental Visit</Badge>
          </div>

          <!-- Clinical Summary -->
          <div class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-slate-600 text-white shadow-sm">
                <FileText class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Clinical Summary</p>
                <p v-if="clinicalSummary" class="mt-1 text-xs leading-relaxed text-muted-foreground [&_b]:text-foreground [&_b]:font-semibold" v-html="clinicalSummary" />
                <p v-else class="mt-1 text-xs italic text-muted-foreground/50">No clinical history recorded yet.</p>
              </div>
            </div>
          </div>

          <!-- DMFT + PSR snapshot -->
          <div v-if="profile" class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
                <Stethoscope class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Dental Snapshot</p>
                <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div v-if="profile.dmft_score != null">
                    <span class="text-muted-foreground">DMFT</span>
                    <p class="font-semibold">{{ profile.dmft_score }}</p>
                  </div>
                  <div v-if="profile.caries_risk">
                    <span class="text-muted-foreground">Caries risk</span>
                    <p class="font-semibold capitalize">{{ profile.caries_risk }}</p>
                  </div>
                  <div v-if="profile.oral_hygiene">
                    <span class="text-muted-foreground">Hygiene</span>
                    <p class="font-semibold capitalize">{{ profile.oral_hygiene }}</p>
                  </div>
                  <div v-if="psrSummary">
                    <span class="text-muted-foreground">PSR max</span>
                    <p class="font-semibold">{{ psrSummary.max }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Dental Visits -->
          <div v-if="recentDentalVisits.length" class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white shadow-sm">
                <Stamp class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Recent Dental Visits</p>
                <div class="mt-2 flex flex-col gap-1.5">
                  <div
                    v-for="v in recentDentalVisits"
                    :key="v.id"
                    class="flex flex-col gap-0.5 rounded-md border border-transparent bg-muted/30 px-2 py-1.5 text-xs"
                  >
                    <p class="font-medium leading-tight">{{ v.triage?.chief_complaint || 'No chief complaint' }}</p>
                    <p class="text-[10px] text-muted-foreground">{{ formatVisitDate(v.visit_date) }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Current Vitals -->
          <div v-if="currentVitals" class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-sm">
                <Activity class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Current Vitals</p>
                <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div v-if="currentVitals.bp_systolic && currentVitals.bp_diastolic">
                    <span class="text-muted-foreground">BP</span>
                    <p class="font-medium">{{ currentVitals.bp_systolic }}/{{ currentVitals.bp_diastolic }} mmHg</p>
                  </div>
                  <div v-if="currentVitals.hr">
                    <span class="text-muted-foreground">HR</span>
                    <p class="font-medium">{{ currentVitals.hr }} bpm</p>
                  </div>
                  <div v-if="currentVitals.temp">
                    <span class="text-muted-foreground">Temp</span>
                    <p class="font-medium">{{ currentVitals.temp }}°C</p>
                  </div>
                  <div v-if="currentVitals.spo2">
                    <span class="text-muted-foreground">SpO₂</span>
                    <p class="font-medium">{{ currentVitals.spo2 }}%</p>
                  </div>
                  <div v-if="currentVitals.pain_score != null">
                    <span class="text-muted-foreground">Pain</span>
                    <p class="font-medium">{{ currentVitals.pain_score }}/10</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Active Problems -->
          <div class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm">
                <AlertCircle class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Active Problems</p>
                <div v-if="activeProblems.length" class="mt-2 flex flex-col gap-1">
                  <div v-for="p in activeProblems" :key="p.uuid" class="flex items-start gap-1.5 text-xs">
                    <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{{ p.description }}</span>
                  </div>
                  <p v-if="pdStore.problems.length > 5" class="text-[10px] text-muted-foreground">
                    +{{ pdStore.problems.length - 5 }} more
                  </p>
                </div>
                <p v-else class="mt-1 text-xs text-muted-foreground">No active problems</p>
              </div>
            </div>
          </div>

          <!-- Allergies -->
          <div class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-sm">
                <ShieldAlert class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Allergies</p>
                <div v-if="activeAllergies.length" class="mt-2 flex flex-wrap gap-1">
                  <Badge v-for="a in activeAllergies" :key="a.uuid" variant="destructive" class="text-[10px]">
                    {{ a.allergen }}
                  </Badge>
                  <Badge v-if="pdStore.allergies.length > 5" variant="outline" class="text-[10px]">
                    +{{ pdStore.allergies.length - 5 }}
                  </Badge>
                </div>
                <p v-else class="mt-1 text-xs text-muted-foreground">No known allergies</p>
              </div>
            </div>
          </div>

          <!-- Active Medications -->
          <div v-if="activeMedications.length" class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-sm">
                <Pill class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Active Medications</p>
                <div class="mt-2 flex flex-col gap-1">
                  <div v-for="m in activeMedications" :key="m.uuid" class="flex items-start gap-1.5 text-xs">
                    <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-500" />
                    <div class="min-w-0 flex-1">
                      <p class="font-medium leading-tight">{{ m.drug_name }}</p>
                      <p v-if="m.dose || m.frequency" class="text-[10px] leading-tight text-muted-foreground">
                        <template v-if="m.dose">{{ m.dose }}</template>
                        <template v-if="m.dose && m.frequency"> · </template>
                        <template v-if="m.frequency">{{ m.frequency }}</template>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Lifestyle -->
          <div v-if="lifestyleSummary.length" class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-sm">
                <Heart class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Lifestyle</p>
                <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div v-for="item in lifestyleSummary" :key="item.label">
                    <p class="text-[10px] text-muted-foreground">{{ item.label }}</p>
                    <p class="font-medium capitalize leading-tight">{{ item.value }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Family History -->
          <div v-if="familyHistoryEntries.length" class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-sm">
                <Users class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Family History</p>
                <div class="mt-2 flex flex-col gap-1.5">
                  <div v-for="f in familyHistoryEntries" :key="f.uuid" class="text-xs">
                    <p class="font-medium capitalize leading-tight">{{ f.relative }}</p>
                    <p v-if="f.conditions.length" class="text-[10px] leading-tight text-muted-foreground">
                      {{ f.conditions.map((c) => c.name).join(', ') }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </aside>

    </div>

    <!-- Tooth edit -->
    <ToothEditDialog
      v-model:open="toothDialogOpen"
      :fdi="editingFdi"
      :initial="editingStampedState"
      @save="onToothSave"
    />

    <!-- Per-tooth history drawer -->
    <DentalToothHistoryDrawer
      v-if="store.current?.patient_id"
      v-model:open="historyDrawerOpen"
      :patient-id="store.current.patient_id"
      :tooth="historyFdi"
    />

    <!-- Edit procedure -->
    <Dialog
      :open="editingProcedureIdx !== null"
      @update:open="(v) => { if (!v) cancelEditProcedure() }"
    >
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Pencil class="size-4 text-muted-foreground" />
            Edit procedure
          </DialogTitle>
          <DialogDescription v-if="editingProcedureDraft">
            Procedure name and CDT code stay locked. Delete and re-add to switch
            material or change the underlying code.
          </DialogDescription>
        </DialogHeader>

        <div v-if="editingProcedureDraft" class="flex flex-col gap-4">
          <div class="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <span
              v-if="editingProcedureDraft.cdt_code"
              class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-muted-foreground"
            >{{ editingProcedureDraft.cdt_code }}</span>
            <span class="truncate text-sm font-medium">{{ editingProcedureDraft.procedure }}</span>
          </div>

          <!-- Tooth picker — Select for single-tooth codes (the modal
               case) or multi Combobox for quadrant codes (D4341/D4342). -->
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">{{ editIsMultiTooth ? `Teeth (${numberingLabel})` : `Tooth (${numberingLabel})` }}</Label>

            <Select
              v-if="!editIsMultiTooth"
              :model-value="editSingleToothValue"
              @update:model-value="(v) => setEditTooth(v)"
            >
              <SelectTrigger class="w-full">
                <SelectValue :placeholder="`Select tooth (${numberingLabel})`" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup v-for="g in toothOptionGroups" :key="g.label">
                  <SelectLabel>{{ g.label }}</SelectLabel>
                  <SelectItem v-for="opt in g.options" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Combobox
              v-else
              :model-value="editTeethValues"
              multiple
              @update:model-value="(v: unknown) => setEditTeethMulti(v as string[] | null)"
            >
              <ComboboxAnchor as-child>
                <div class="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs">
                  <ComboboxInput
                    :placeholder="editTeeth.size > 0 ? `${editTeeth.size} selected — search teeth…` : `Search teeth (${numberingLabel})`"
                    class="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <ComboboxTrigger class="shrink-0">
                    <ChevronsUpDown class="size-4 text-muted-foreground" />
                  </ComboboxTrigger>
                </div>
              </ComboboxAnchor>
              <ComboboxList class="w-(--reka-combobox-trigger-width) p-1">
                <ComboboxViewport class="max-h-[260px]">
                  <ComboboxEmpty class="px-2 py-1.5 text-center text-sm text-muted-foreground">No match</ComboboxEmpty>
                  <ComboboxGroup v-for="g in toothOptionGroups" :key="g.label">
                    <div class="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {{ g.label }}
                    </div>
                    <ComboboxItem
                      v-for="opt in g.options"
                      :key="opt.value"
                      :value="opt.value"
                      class="flex items-center gap-2 px-2 py-1.5"
                    >
                      <span class="flex size-4 shrink-0 items-center justify-center">
                        <Check v-if="editTeeth.has(opt.fdi)" class="size-4" />
                      </span>
                      {{ opt.label }}
                    </ComboboxItem>
                  </ComboboxGroup>
                </ComboboxViewport>
              </ComboboxList>
            </Combobox>
          </div>

          <!-- Surfaces — only relevant for filling/sealant codes. -->
          <div v-if="editIsSurfaceProc" class="flex flex-col gap-1.5">
            <Label class="text-xs">Surfaces</Label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="s in (['mesial','occlusal','distal','buccal','lingual','incisal'] as ToothSurface[])"
                :key="s"
                type="button"
                class="rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors"
                :class="editSurfaces.has(s) ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted'"
                @click="toggleEditSurface(s)"
              >{{ s.charAt(0).toUpperCase() }} · {{ s }}</button>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Billable amount (₱)</Label>
            <Input
              v-model.number="editingProcedureDraft.billable_amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Notes</Label>
            <Textarea
              v-model="editingProcedureDraft.notes"
              rows="2"
              placeholder="Optional notes for this procedure"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="cancelEditProcedure">Cancel</Button>
          <Button @click="saveEditProcedure">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Finalize confirmation -->
    <Dialog v-model:open="showFinalizeModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <AlertTriangle class="size-5 text-amber-500" />
            Finalize this visit?
          </DialogTitle>
          <DialogDescription>Once finalized, the visit becomes read-only and the invoice is locked. You can still record payments.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showFinalizeModal = false">Cancel</Button>
          <Button @click="onFinalize">Finalize</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </Tabs>
</template>

