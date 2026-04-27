<script setup lang="ts">
import { computed } from 'vue'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { isAnteriorFdi, isPrimaryFdi } from '../composables/useToothSvg'
import { useToothNumbering } from '../composables/useToothNumbering'
import type {
  StampedToothState,
  ToothSurface,
  CariesSeverity,
  FillingMaterial,
  CrownMaterial,
  FractureVariant,
  EndoType,
  PostMaterial,
  BruxismVariant,
  ImplantStage,
  BridgeMaterial,
  BridgeRole,
  ModKind,
  SpecialKind,
  ToothBase,
  PerioToothRecord,
  DentalProcedureLog,
} from '../types/dental.types'

/**
 * Sidebar charting panel — playground-style controls for the active tooth.
 * Each click emits a partial `StampedToothState` delta (incremental, not full
 * diff). The host merges it into `assessment.odontogram_delta` and saves.
 *
 * `{ __remove: true }` sentinels clear a previously-set field.
 */

interface Props {
  fdi: number | null
  state?: StampedToothState | null
  /** Per-tooth deltas accumulated during the current assessment. Used to
   * render the "session findings" summary when no tooth is selected. */
  sessionDelta?: Record<string, Partial<StampedToothState>> | null
  /** FDI-keyed perio chart for the current visit (PD/BOP/mobility). Folded
   * into the session summary so teeth probed without other deltas still
   * appear in the list. */
  perioChart?: Record<string, PerioToothRecord> | null
  /** Plan-tab procedures for the current visit. Surfaced under each
   * session-findings row when at least one procedure targets that tooth,
   * so the dentist can see "what was found" + "what's planned" together. */
  procedures?: DentalProcedureLog[] | null
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  state: null,
  sessionDelta: null,
  perioChart: null,
  procedures: null,
  disabled: false,
})

const emit = defineEmits<{
  apply: [delta: Partial<StampedToothState>]
  'open-detail': []
  'reset-tooth': []
  'select-tooth': [fdi: number]
  /** Fired when base changes across the natural↔implant boundary, so the
   * parent can drop `perio_chart[fdi]` (PD / BOP / mobility-grade values
   * that belonged to a different physical structure). */
  'clear-perio': [fdi: number]
}>()

const { format: formatTooth } = useToothNumbering()

const hasActive = computed(() => props.fdi != null)
const isAnterior = computed(() => (props.fdi != null ? isAnteriorFdi(props.fdi) : false))
const isPrimary = computed(() => (props.fdi != null ? isPrimaryFdi(props.fdi) : false))
// Tooth-substance controls (caries, fillings, crowns, endo, etc.) collapse
// when the tooth is marked missing — there's no tooth to put findings on.
// Bridge/implant/plan flags stay because they describe the empty slot.
const isMissing = computed(() => !!props.state?.missing)
// Implants don't get decay, fillings, sealants, RCT, or enamel fracture —
// the titanium fixture + crown structure has no enamel/pulp/dentin layers
// to support those findings. Peri-implant *mobility / probing* + crown +
// bridge + plan flags do stay applicable, so we hide a tighter subset
// than the missing-tooth case.
const isImplant = computed(() => props.state?.base === 'implant')
// Bridge pontic = the tooth at this slot is replaced by the suspended
// bridge unit. No natural tooth means no substance findings apply, same
// as missing. Bridge abutments KEEP substance findings (the natural tooth
// is still there, prepped under the bridge crown).
const isBridgePontic = computed(() => props.state?.bridge?.role === 'pontic')
// Convenience flag: tooth has no natural-tissue findings to record.
const hideToothSubstance = computed(() =>
  isMissing.value || isImplant.value || isBridgePontic.value,
)
// Once endodontic treatment has been recorded (canal filled / RCT complete),
// the pulp tissue is gone — pulpitis can no longer occur, so hide the
// Pulpitis toggle to avoid confusing follow-up data entry.
const hasEndoTreatment = computed(() => !!props.state?.endo?.type)
// Implant stage only makes sense on an actual implant fixture. Show the
// section when base is `implant`, OR when stage data is already recorded
// (so legacy / mid-edit state stays visible and editable).
const showImplantStage = computed(() => isImplant.value || !!props.state?.implant)

const SURFACES: ToothSurface[] = ['mesial', 'distal', 'occlusal', 'buccal', 'lingual']

const baseOptions: { value: ToothBase; label: string }[] = [
  { value: 'tooth', label: 'Permanent' },
  { value: 'milktooth', label: 'Primary' },
  { value: 'implant', label: 'Implant' },
]

const cariesOptions: { value: CariesSeverity; label: string }[] = [
  { value: 'early', label: 'Early' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
]

const fillingOptions: { value: FillingMaterial; label: string; short: string }[] = [
  { value: 'amalgam', label: 'Amalgam', short: 'A' },
  { value: 'composite', label: 'Composite', short: 'C' },
  { value: 'glass_ionomer', label: 'GIC', short: 'G' },
  { value: 'temporary', label: 'Temp', short: 'T' },
]

const crownOptions: { value: CrownMaterial; label: string }[] = [
  { value: 'zircon', label: 'Zircon' },
  { value: 'metal', label: 'Metal' },
  { value: 'pfm', label: 'PFM' },
  { value: 'porcelain', label: 'Porcelain' },
  { value: 'emax', label: 'e.max' },
  { value: 'resin', label: 'Resin' },
  { value: 'temporary', label: 'Temp' },
]

const endoOptions: { value: EndoType; label: string }[] = [
  { value: 'endo-filling', label: 'RCT complete' },
  { value: 'endo-filling-incomplete', label: 'RCT partial' },
  { value: 'endo-resection', label: 'Resection' },
]

const postOptions: { value: PostMaterial; label: string }[] = [
  { value: 'glass', label: 'Glass post' },
  { value: 'metal', label: 'Metal post' },
]

const fractureOptions: { value: FractureVariant; label: string }[] = [
  { value: 'mesial', label: 'M' },
  { value: 'incisal', label: 'I' },
  { value: 'distal', label: 'D' },
  { value: 'mesial-incisal', label: 'M+I' },
  { value: 'mesial-distal', label: 'M+D' },
  { value: 'distal-incisal', label: 'D+I' },
  { value: 'mesial-distal-incisal', label: 'M+D+I' },
]

const bruxismOptions: { value: BruxismVariant; label: string }[] = [
  { value: 'wear', label: 'Occl wear' },
  { value: 'neck-wear', label: 'Neck wear' },
  { value: 'both', label: 'Both' },
]

const implantOptions: { value: ImplantStage; label: string }[] = [
  { value: 'base', label: 'Base placed' },
  { value: 'healing-abutment', label: 'Healing' },
  { value: 'bar', label: 'Bar' },
  { value: 'locator-screw', label: 'Locator' },
]

const bridgeOptions: { value: BridgeMaterial; label: string }[] = [
  { value: 'zircon', label: 'Zircon' },
  { value: 'metal', label: 'Metal' },
  { value: 'telescope', label: 'Telescope' },
  { value: 'temporary', label: 'Temp' },
  { value: 'prosthesis', label: 'Prosthesis' },
]

const modOptions = computed<{ value: ModKind; label: string }[]>(() => {
  const all: { value: ModKind; label: string }[] = [
    { value: 'inflammation-inside', label: 'Apical (contained)' },
    { value: 'inflammation-outside', label: 'Apical (fistula)' },
    { value: 'mobility', label: 'Mobility' },
  ]
  // Mobility requires a tooth in the socket to wiggle. Apical inflammation
  // / fistula can still appear on the periapex of an empty socket (residual
  // root, socket infection) so we keep those.
  return isMissing.value ? all.filter((m) => m.value !== 'mobility') : all
})

const specialOptions: { value: SpecialKind; label: string }[] = [
  { value: 'extraction-plan', label: 'Extraction plan' },
  { value: 'crown-needed', label: 'Crown needed' },
  { value: 'crown-replace', label: 'Crown replace' },
  { value: 'missing-closed', label: 'Closed gap' },
]

// ── Selectors over current state ──────────────────────────────────────
function cariesSet(surf: ToothSurface, severity: CariesSeverity | null): Partial<StampedToothState> {
  const surfaces: Record<string, unknown> = {
    [surf]: severity ? { severity } : { __remove: true },
  }
  return { caries: surfaces as StampedToothState['caries'] }
}
function fillingSet(surf: ToothSurface, material: FillingMaterial | null): Partial<StampedToothState> {
  const surfaces: Record<string, unknown> = {
    [surf]: material ? { material } : { __remove: true },
  }
  return { fillings: surfaces as StampedToothState['fillings'] }
}
function sealantToggle(surf: ToothSurface, on: boolean): Partial<StampedToothState> {
  const surfaces: Record<string, unknown> = {
    [surf]: on ? { value: 'complete' } : { __remove: true },
  }
  return { sealants: surfaces as StampedToothState['sealants'] }
}

function setBase(value: ToothBase) {
  if (props.disabled) return
  // Type-aware cleanup on base change. Permanent ↔ Primary is just a
  // classification fix on the same physical tooth, so caries/fillings/etc.
  // stay valid — no cleanup. Tooth ↔ Implant is the meaningful boundary:
  // the physical structure in the socket changes, so any finding that
  // describes that structure must be reset.
  //   - tooth → implant: titanium has no enamel/pulp, so natural-tissue
  //     findings (caries, fillings, sealants, endo, post, fracture,
  //     pulpitis, bruxism) no longer apply. Apical mods + mobility +
  //     perio probing belonged to the natural root — clear those too.
  //     Crown / bridge / specials / notes still apply (implant crown,
  //     abutment, extraction-plan, free-text).
  //   - implant → tooth/milktooth: the implant fixture stage is moot;
  //     so are any peri-implant mods / probing readings. Drop them.
  // Missing remains mutually exclusive with implant.
  const delta: Partial<StampedToothState> = { base: value }
  const cur = props.state
  const wasImplant = cur?.base === 'implant'
  const willBeImplant = value === 'implant'
  const crossesBoundary = wasImplant !== willBeImplant
  if (willBeImplant) {
    if (cur?.missing) delta.missing = { __remove: true } as never
    for (const f of ['caries', 'fillings', 'sealants'] as const) {
      const surf = cur?.[f]
      if (!surf) continue
      const removed: Record<string, unknown> = {}
      for (const k of Object.keys(surf)) removed[k] = { __remove: true }
      delta[f] = removed as never
    }
    for (const f of ['endo', 'post', 'fracture', 'pulpitis', 'bruxism'] as const) {
      if (cur?.[f]) delta[f] = { __remove: true } as never
    }
  } else if (cur?.implant) {
    delta.implant = { __remove: true } as never
  }
  if (crossesBoundary && cur?.mods?.length) {
    delta.mods = cur.mods
      .filter((m) => m?.kind)
      .map((m) => ({ kind: m.kind, __remove: true })) as never
  }
  emit('apply', delta)
  if (crossesBoundary && props.fdi != null) emit('clear-perio', props.fdi)
}
function setCrown(material: CrownMaterial) {
  if (props.disabled) return
  const same = props.state?.crown?.material === material
  emit('apply', { crown: same ? ({ __remove: true } as never) : ({ material } as StampedToothState['crown']) })
}
function setFracture(variant: FractureVariant) {
  if (props.disabled) return
  const same = props.state?.fracture?.variant === variant
  emit('apply', { fracture: same ? ({ __remove: true } as never) : ({ variant } as StampedToothState['fracture']) })
}
function setBruxism(variant: BruxismVariant) {
  if (props.disabled) return
  const same = props.state?.bruxism?.variant === variant
  emit('apply', { bruxism: same ? ({ __remove: true } as never) : ({ variant } as StampedToothState['bruxism']) })
}
function setEndo(type: EndoType) {
  if (props.disabled) return
  const same = props.state?.endo?.type === type
  emit('apply', { endo: same ? ({ __remove: true } as never) : ({ type } as StampedToothState['endo']) })
}
function setPost(material: PostMaterial) {
  if (props.disabled) return
  const same = props.state?.post?.material === material
  emit('apply', { post: same ? ({ __remove: true } as never) : ({ material } as StampedToothState['post']) })
}
function setImplant(stage: ImplantStage) {
  if (props.disabled) return
  const same = props.state?.implant?.stage === stage
  emit('apply', { implant: same ? ({ __remove: true } as never) : ({ stage } as StampedToothState['implant']) })
}
// A pontic IS a missing-tooth replacement, so the data layer must say
// "missing" alongside any pontic entry. An abutment, conversely, is a
// natural tooth (or implant) prepped under the bridge crown — it can't
// also be flagged missing.
function missingDelta(present: boolean): Partial<StampedToothState> {
  return present
    ? { missing: { status: 'existing', source_visit_id: null, recorded_at: null, recorded_by: null, since: null, cause: null } as StampedToothState['missing'] }
    : { missing: { __remove: true } as never }
}

function setBridgeMat(material: BridgeMaterial) {
  if (props.disabled) return
  const cur = props.state?.bridge
  if (cur?.material === material) {
    // Toggle off — also clear missing if it was set as a side-effect of
    // the pontic state. Conservative cleanup: only clear when role was
    // pontic so we don't wipe a manually-set missing flag.
    const delta: Partial<StampedToothState> = { bridge: { __remove: true } as never }
    if (cur?.role === 'pontic' && props.state?.missing && props.state?.base !== 'implant') {
      Object.assign(delta, missingDelta(false))
    }
    emit('apply', delta)
    return
  }
  // Default role = pontic — the suspended replacement is the most common
  // bridge unit the dentist is recording first. Switch to abutment from
  // the role buttons below if needed.
  const role = cur?.role ?? 'pontic'
  const delta: Partial<StampedToothState> = {
    bridge: { material, role } as StampedToothState['bridge'],
  }
  if (role === 'pontic' && !props.state?.missing) {
    Object.assign(delta, missingDelta(true))
  }
  emit('apply', delta)
}

function setBridgeRole(role: BridgeRole) {
  if (props.disabled) return
  const cur = props.state?.bridge
  if (!cur) return
  const delta: Partial<StampedToothState> = {
    bridge: { material: cur.material, role } as StampedToothState['bridge'],
  }
  if (role === 'pontic' && !props.state?.missing) {
    // Promoting an abutment to pontic — slot is now a replacement.
    Object.assign(delta, missingDelta(true))
  } else if (role === 'abutment' && props.state?.missing && props.state?.base !== 'implant') {
    // Abutment is a present tooth — clear the missing flag that the
    // pontic state had previously enforced.
    Object.assign(delta, missingDelta(false))
  }
  emit('apply', delta)
}
function togglePulpitis() {
  if (props.disabled) return
  const on = props.state?.pulpitis?.status === 'existing'
  emit('apply', {
    pulpitis: on
      ? ({ __remove: true } as never)
      : ({ status: 'existing', source_visit_id: null, recorded_at: null, recorded_by: null } as StampedToothState['pulpitis']),
  })
}
function toggleMissing() {
  if (props.disabled) return
  const on = !!props.state?.missing
  const delta: Partial<StampedToothState> = {
    missing: on
      ? ({ __remove: true } as never)
      : ({ status: 'existing', source_visit_id: null, recorded_at: null, recorded_by: null, since: null, cause: null } as StampedToothState['missing']),
  }
  // Going from implant → missing clears the implant base so the two
  // statuses don't disagree. Stay as 'tooth' afterwards (default base).
  if (!on && props.state?.base === 'implant') {
    delta.base = 'tooth'
  }
  // Going from missing → present (`on === true`) while the slot is a
  // bridge pontic: drop the bridge too. A pontic over a real tooth is
  // clinically impossible and would leave the data layer inconsistent.
  if (on && props.state?.bridge?.role === 'pontic') {
    delta.bridge = { __remove: true } as never
  }
  emit('apply', delta)
}
function toggleMod(kind: ModKind) {
  if (props.disabled) return
  const cur = props.state?.mods ?? []
  const has = cur.some((m) => m.kind === kind)
  emit('apply', { mods: [{ kind, ...(has ? { __remove: true } : {}) }] as never })
}
function toggleSpecial(kind: SpecialKind) {
  if (props.disabled) return
  const cur = props.state?.specials ?? []
  const has = cur.some((s) => s.kind === kind)
  emit('apply', { specials: [{ kind, ...(has ? { __remove: true } : {}) }] as never })
}
function updateNotes(value: string) {
  if (props.disabled) return
  emit('apply', { notes: value || null })
}

// Caries — toggle the surface itself (default severity = 'moderate').
function toggleCaries(surf: ToothSurface) {
  if (props.disabled) return
  const cur = props.state?.caries?.[surf]?.severity ?? null
  emit('apply', cariesSet(surf, cur ? null : 'moderate'))
}
function setCariesSeverity(surf: ToothSurface, sev: CariesSeverity) {
  if (props.disabled) return
  // Severity row only changes severity, never clears the lesion. Removal is
  // owned by the surface chip above (clicking it again toggles off).
  const cur = props.state?.caries?.[surf]?.severity
  if (cur === sev) return
  emit('apply', cariesSet(surf, sev))
}

// Filling material — click to set/swap, click same to remove.
function setFilling(surf: ToothSurface, material: FillingMaterial) {
  if (props.disabled) return
  const cur = props.state?.fillings?.[surf]?.material
  emit('apply', fillingSet(surf, cur === material ? null : material))
}

// Sealant — boolean per surface.
function toggleSealant(surf: ToothSurface) {
  if (props.disabled) return
  const cur = !!props.state?.sealants?.[surf]
  emit('apply', sealantToggle(surf, !cur))
}

// ── Selector helpers (for highlighting) ──────────────────────────────
function isCariesSet(surf: ToothSurface) {
  return !!props.state?.caries?.[surf]
}
function cariesSeverity(surf: ToothSurface) {
  return props.state?.caries?.[surf]?.severity ?? null
}
function fillingMat(surf: ToothSurface) {
  return props.state?.fillings?.[surf]?.material ?? null
}
function isSealantOn(surf: ToothSurface) {
  return !!props.state?.sealants?.[surf]
}

// Surfaces actually carrying caries — drives the per-surface severity table.
const litCariesSurfaces = computed<ToothSurface[]>(() =>
  SURFACES.filter((s) => !!props.state?.caries?.[s]),
)

// "occlusal" surface label flips to "incisal" for anterior teeth.
function surfaceLabel(surf: ToothSurface): string {
  if (surf === 'occlusal' && isAnterior.value) return 'incisal'
  return surf
}

// ── Session summary (shown when no tooth is selected) ─────────────────
// Distills a per-tooth delta into short human-readable chips. We only
// surface fields the dentist actively touched THIS visit — `sessionDelta`
// is the assessment's `odontogram_delta`, which contains only the leaves
// that have been set/cleared during this encounter (not the merged
// profile baseline), so any non-empty entry == a session change.

const SURFACE_INITIAL: Record<ToothSurface, string> = {
  mesial: 'M',
  distal: 'D',
  occlusal: 'O',
  buccal: 'B',
  lingual: 'L',
}
function isRemovalSentinel(v: unknown): boolean {
  return !!(v && typeof v === 'object' && (v as { __remove?: boolean }).__remove === true)
}
function compactSurfaces(map: Record<string, unknown> | undefined, anterior: boolean): string {
  if (!map) return ''
  const keys = (Object.keys(map) as ToothSurface[]).filter(
    (k) => map[k] != null && !isRemovalSentinel(map[k]),
  )
  if (keys.length === 0) return ''
  // Order MODBL for readability; flip O→I for anterior teeth.
  const order: ToothSurface[] = ['mesial', 'occlusal', 'distal', 'buccal', 'lingual']
  return order
    .filter((s) => keys.includes(s))
    .map((s) => (s === 'occlusal' && anterior ? 'I' : SURFACE_INITIAL[s]))
    .join('')
}

interface SummaryChip { label: string; tone: 'caries' | 'restorative' | 'state' | 'plan' }

function summarizeDelta(delta: Partial<StampedToothState>, fdi: number): SummaryChip[] {
  const chips: SummaryChip[] = []
  const anterior = isAnteriorFdi(fdi)

  // Caries — surface initials + the worst severity across affected surfaces,
  // so the dentist can read "MO caries · severe" instead of just "MO caries".
  const cariesMap = delta.caries as Record<string, { severity?: string } | undefined> | undefined
  const cSurf = compactSurfaces(cariesMap as Record<string, unknown> | undefined, anterior)
  if (cSurf) {
    const severities = cariesMap
      ? Object.values(cariesMap).map((v) => v?.severity).filter((s): s is string => !!s)
      : []
    const worst = severities.includes('severe') ? 'severe'
      : severities.includes('moderate') ? 'moderate'
      : severities.includes('early') ? 'early' : null
    chips.push({ label: worst ? `${cSurf} caries · ${worst}` : `${cSurf} caries`, tone: 'caries' })
  }

  // Fillings — surface initials + the common material if all surfaces share one.
  const fillingsMap = delta.fillings as Record<string, { material?: string } | undefined> | undefined
  const fSurf = compactSurfaces(fillingsMap as Record<string, unknown> | undefined, anterior)
  if (fSurf) {
    const mats = fillingsMap
      ? Array.from(new Set(Object.values(fillingsMap).map((v) => v?.material).filter((m): m is string => !!m)))
      : []
    const matLabel = mats.length === 1 ? mats[0] : (mats.length > 1 ? 'mixed' : null)
    chips.push({ label: matLabel ? `${fSurf} filling · ${matLabel}` : `${fSurf} filling`, tone: 'restorative' })
  }

  // Sealants
  const sSurf = compactSurfaces(delta.sealants as Record<string, unknown> | undefined, anterior)
  if (sSurf) chips.push({ label: `${sSurf} sealant`, tone: 'restorative' })

  if (delta.crown && !isRemovalSentinel(delta.crown)) {
    const mat = (delta.crown as { material?: string }).material
    chips.push({ label: mat ? `Crown · ${mat}` : 'Crown', tone: 'restorative' })
  }
  if (delta.endo && !isRemovalSentinel(delta.endo)) {
    const t = (delta.endo as { type?: string }).type
    const endoLabel = t === 'endo-resection' ? 'Resection'
      : t === 'endo-filling-incomplete' ? 'RCT (partial)'
      : 'RCT'
    chips.push({ label: endoLabel, tone: 'restorative' })
  }
  if (delta.post && !isRemovalSentinel(delta.post)) {
    const mat = (delta.post as { material?: string }).material
    chips.push({ label: mat ? `Post · ${mat}` : 'Post', tone: 'restorative' })
  }
  if (delta.fracture && !isRemovalSentinel(delta.fracture)) {
    const variant = (delta.fracture as { variant?: string }).variant
    chips.push({ label: variant ? `Fracture · ${variant}` : 'Fracture', tone: 'state' })
  }
  if (delta.pulpitis && !isRemovalSentinel(delta.pulpitis)) {
    chips.push({ label: 'Pulpitis', tone: 'state' })
  }
  if (delta.bruxism && !isRemovalSentinel(delta.bruxism)) {
    const v = (delta.bruxism as { variant?: string }).variant
    const bruxLabel = v === 'wear' ? 'Bruxism · occl wear'
      : v === 'neck-wear' ? 'Bruxism · cervical wear'
      : v === 'both' ? 'Bruxism · occl + cervical'
      : 'Bruxism'
    chips.push({ label: bruxLabel, tone: 'state' })
  }
  if (delta.implant && !isRemovalSentinel(delta.implant)) {
    const stage = (delta.implant as { stage?: string }).stage
    const stageLabels: Record<string, string> = {
      base: 'fixture placed',
      'healing-abutment': 'healing',
      bar: 'bar',
      'locator-screw': 'locator',
    }
    const stageLabel = stage ? (stageLabels[stage] ?? stage) : null
    chips.push({ label: stageLabel ? `Implant · ${stageLabel}` : 'Implant', tone: 'state' })
  }
  if (delta.bridge && !isRemovalSentinel(delta.bridge)) {
    const b = delta.bridge as { role?: string; material?: string }
    const parts = [b.role, b.material].filter(Boolean)
    chips.push({ label: parts.length > 0 ? `Bridge · ${parts.join(' / ')}` : 'Bridge', tone: 'restorative' })
  }
  if (delta.missing && !isRemovalSentinel(delta.missing)) {
    chips.push({ label: 'Missing', tone: 'state' })
  }
  if (delta.base) {
    const map: Record<string, string> = { tooth: 'Permanent', milktooth: 'Primary', implant: 'Implant' }
    const lbl = map[delta.base as string] ?? String(delta.base)
    // Only surface base when it's notable (anything other than the implicit
    // default "Permanent") to avoid noisy chips on every touched tooth.
    if (delta.base !== 'tooth') chips.push({ label: lbl, tone: 'state' })
  }
  // Mods / specials are kind-keyed lists. Resolve them like mergeToothDelta:
  // a later `__remove` entry for a kind suppresses any earlier real entries
  // of the same kind. This matters because the raw delta can carry mixed
  // entries — e.g. legacy duplicates plus a fresh `__remove` toggle — and we
  // must surface the *net* state, not every line item.
  const resolveListByKind = (
    list: Array<{ kind?: string; __remove?: boolean }> | undefined,
  ): string[] => {
    if (!list?.length) return []
    const map = new Map<string, { kind: string; __remove?: boolean }>()
    for (const e of list) {
      if (!e?.kind) continue
      map.set(e.kind, { kind: e.kind, __remove: e.__remove })
    }
    return Array.from(map.values())
      .filter((e) => !e.__remove)
      .map((e) => e.kind)
  }
  const modLabels: Record<string, string> = {
    mobility: 'Mobility',
    'inflammation-inside': 'Apical (contained)',
    'inflammation-outside': 'Apical (fistula)',
  }
  for (const kind of resolveListByKind(delta.mods as never)) {
    chips.push({ label: modLabels[kind] ?? kind, tone: 'state' })
  }
  const specialLabels: Record<string, string> = {
    'extraction-plan': 'Extract',
    'crown-needed': 'Crown needed',
    'crown-replace': 'Crown replace',
    'missing-closed': 'Closed gap',
  }
  for (const kind of resolveListByKind(delta.specials as never)) {
    chips.push({ label: specialLabels[kind] ?? kind, tone: 'plan' })
  }
  return chips
}

const ROMAN_MOBILITY: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' }
function summarizePerio(rec: PerioToothRecord | null | undefined): SummaryChip[] {
  if (!rec) return []
  const chips: SummaryChip[] = []
  const facial = rec.facial ?? []
  const lingual = rec.lingual ?? []
  const all = [...facial, ...lingual]
  const pdValues = all.map((p) => p?.pd).filter((n): n is number => typeof n === 'number')
  if (pdValues.length > 0) {
    const max = Math.max(...pdValues)
    chips.push({ label: `PD max ${max}`, tone: max >= 6 ? 'caries' : max >= 4 ? 'plan' : 'state' })
  }
  const bopCount = all.filter((p) => p?.bop).length
  if (bopCount > 0) {
    chips.push({ label: bopCount === 1 ? 'BOP' : `BOP ×${bopCount}`, tone: 'caries' })
  }
  const mob = rec.mobility ?? 0
  if (mob > 0) {
    chips.push({ label: `Mobility ${ROMAN_MOBILITY[mob] ?? mob}`, tone: 'state' })
  }
  return chips
}

function mergePerioMobility(deltaChips: SummaryChip[], perioChips: SummaryChip[]): SummaryChip[] {
  // If the delta already produced a "Mobility" chip (from `mods.mobility`),
  // and perio has a graded mobility chip, upgrade the delta chip in place
  // with the Roman numeral instead of carrying both. Drop the perio
  // duplicate so the row shows one mobility chip with full info.
  const perioMob = perioChips.find((c) => c.label.startsWith('Mobility '))
  if (!perioMob) return [...deltaChips, ...perioChips]
  const idx = deltaChips.findIndex((c) => c.label === 'Mobility')
  if (idx >= 0) {
    const merged = deltaChips.slice()
    merged[idx] = { ...merged[idx]!, label: perioMob.label }
    return [...merged, ...perioChips.filter((c) => c !== perioMob)]
  }
  return [...deltaChips, ...perioChips]
}

interface PlanLine {
  label: string        // short procedure name
  code: string | null  // CDT code badge
  detail: string | null // surfaces / material qualifier (e.g., "MOD · composite")
  amount: number
}

interface SummaryRow {
  fdi: number
  chips: SummaryChip[]
  planLines: PlanLine[]
}

// Build an FDI → matching procedures map once per `procedures` change so
// the per-row computation stays O(rows + procedures) rather than O(rows × procedures).
const planByFdi = computed<Map<number, PlanLine[]>>(() => {
  const map = new Map<number, PlanLine[]>()
  for (const proc of props.procedures ?? []) {
    if (!proc?.teeth?.length) continue
    const surfaces = (proc.surfaces ?? []).map((s) => s.charAt(0).toUpperCase()).join('')
    const detailParts = [surfaces || null, proc.material ?? null].filter(Boolean) as string[]
    const line: PlanLine = {
      label: proc.procedure,
      code: proc.cdt_code ?? null,
      detail: detailParts.length > 0 ? detailParts.join(' · ') : null,
      amount: typeof proc.billable_amount === 'number' ? proc.billable_amount : 0,
    }
    for (const t of proc.teeth) {
      const fdi = Number(t)
      if (!Number.isFinite(fdi)) continue
      const list = map.get(fdi) ?? []
      list.push(line)
      map.set(fdi, list)
    }
  }
  return map
})

const sessionSummary = computed<SummaryRow[]>(() => {
  const deltaMap = props.sessionDelta ?? {}
  const perioMap = props.perioChart ?? {}
  // Union of FDI keys — a tooth shows up if it has either a delta OR a
  // perio-chart entry OR a plan procedure targeting it.
  const fdis = new Set<string>()
  for (const k of Object.keys(deltaMap)) fdis.add(k)
  for (const raw of Object.keys(perioMap)) {
    const k = raw.startsWith('t') ? raw.slice(1) : raw
    fdis.add(k)
  }
  for (const fdi of planByFdi.value.keys()) fdis.add(String(fdi))

  const rows: SummaryRow[] = []
  for (const key of fdis) {
    const fdi = Number(key)
    if (!Number.isFinite(fdi)) continue
    const deltaChips = summarizeDelta(deltaMap[key] ?? {}, fdi)
    const perioRec = perioMap[key] ?? perioMap[`t${key}`] ?? null
    const perioChips = summarizePerio(perioRec)
    const chips = mergePerioMobility(deltaChips, perioChips)
    const planLines = planByFdi.value.get(fdi) ?? []
    if (chips.length > 0 || planLines.length > 0) {
      rows.push({ fdi, chips, planLines })
    }
  }
  // Sort by chart order: upper right (18→11), upper left (21→28), lower left
  // (38→31), lower right (41→48). Keeps the list visually aligned with the
  // chart so dentists can scan top-to-bottom.
  const order = (fdi: number) => {
    const q = Math.floor(fdi / 10)
    const t = fdi % 10
    if (q === 1 || q === 5) return [0, q, -t] as const
    if (q === 2 || q === 6) return [0, q, t] as const
    if (q === 3 || q === 7) return [1, q, -t] as const
    return [1, q, t] as const
  }
  rows.sort((a, b) => {
    const oa = order(a.fdi), ob = order(b.fdi)
    return oa[0] - ob[0] || oa[1] - ob[1] || oa[2] - ob[2]
  })
  return rows
})
</script>

<template>
  <div class="charting-panel flex flex-col gap-3">
    <!-- Header (active tooth) — only shown when a tooth is focused. The
         summary mode (no active tooth) leads with the Session findings
         section directly, so the empty-state "—" placeholder doesn't
         compete with it for visual weight. -->
    <div v-if="hasActive" class="rounded-2xl border bg-card p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Active tooth</p>
          <p class="font-mono text-2xl font-bold leading-none">{{ formatTooth(fdi as number) }}</p>
          <p class="mt-1 text-[10px] text-muted-foreground">
            {{ isPrimary ? 'Primary' : 'Permanent' }} · {{ isAnterior ? 'Anterior' : 'Posterior' }}
          </p>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" class="chip-sm" :disabled="disabled" @click="emit('reset-tooth')">Reset</button>
          <button type="button" class="chip-sm" :disabled="disabled" @click="emit('open-detail')">Detail…</button>
        </div>
      </div>
    </div>

    <template v-if="!hasActive">
      <!-- Session findings summary — only the changes made on THIS visit.
           Past findings live on the merged chart, not here. -->
      <section v-if="sessionSummary.length > 0" class="panel">
        <div class="mb-2 flex items-center justify-between">
          <h4 class="panel-title mb-0">Session findings</h4>
          <span class="text-[10px] font-medium text-muted-foreground">{{ sessionSummary.length }}</span>
        </div>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="row in sessionSummary"
            :key="row.fdi"
            class="session-row"
            :class="{ 'has-plan': row.planLines.length > 0 }"
            tabindex="0"
            role="button"
            @click="emit('select-tooth', row.fdi)"
            @keydown.enter.prevent="emit('select-tooth', row.fdi)"
            @keydown.space.prevent="emit('select-tooth', row.fdi)"
          >
            <span class="session-fdi">{{ formatTooth(row.fdi) }}</span>
            <div class="session-body">
              <span v-if="row.chips.length > 0" class="session-chips">
                <span
                  v-for="(chip, idx) in row.chips"
                  :key="idx"
                  class="session-chip"
                  :data-tone="chip.tone"
                >{{ chip.label }}</span>
              </span>
              <span v-else class="text-[10px] italic text-muted-foreground">no findings — plan only</span>
              <ul v-if="row.planLines.length > 0" class="plan-lines">
                <li
                  v-for="(line, i) in row.planLines"
                  :key="`${line.code ?? line.label}-${i}`"
                  class="plan-line"
                >
                  <span v-if="line.code" class="plan-code">{{ line.code }}</span>
                  <span class="plan-name">{{ line.label }}</span>
                  <span v-if="line.detail" class="plan-detail">· {{ line.detail }}</span>
                  <span v-if="line.amount > 0" class="plan-amount">₱{{ line.amount.toFixed(0) }}</span>
                </li>
              </ul>
            </div>
          </li>
        </ul>
      </section>
      <div v-else class="rounded-2xl border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
        Click a tooth on the chart to start charting. New findings recorded
        this visit will appear here.
      </div>
    </template>

    <template v-else>
      <!-- Base classification -->
      <section class="panel">
        <h4 class="panel-title">Tooth base</h4>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="b in baseOptions"
            :key="b.value"
            type="button"
            class="chip"
            :aria-pressed="state?.base === b.value"
            :disabled="disabled"
            @click="setBase(b.value)"
          >{{ b.label }}</button>
          <button
            v-if="state?.base !== 'implant'"
            type="button"
            class="chip col-span-3"
            :aria-pressed="!!state?.missing"
            :disabled="disabled"
            @click="toggleMissing"
          >Missing</button>
        </div>
      </section>

      <!-- Status banner — surfaces why the substance sections collapsed. -->
      <div
        v-if="hideToothSubstance"
        class="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-3 text-center text-[11px] leading-snug text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200"
      >
        <template v-if="isMissing">
          Tooth marked <strong>missing</strong>. Substance-level findings are hidden.<br>
          Bridge / implant / plan flags below still apply to the empty slot.
        </template>
        <template v-else-if="isImplant">
          Tooth is an <strong>implant</strong>. Caries / fillings / pulp / fracture findings don't apply to titanium.<br>
          Crown, bridge, peri-implant probing &amp; mobility are still tracked below.
        </template>
        <template v-else-if="isBridgePontic">
          Slot is a <strong>bridge pontic</strong>. The natural tooth has been replaced by the suspended bridge unit, so substance findings don't apply.<br>
          Switch the bridge role to <strong>abutment</strong> below if this tooth is the anchor instead.
        </template>
      </div>

      <!-- Caries per surface -->
      <section v-if="!hideToothSubstance" class="panel">
        <h4 class="panel-title">Caries</h4>
        <p class="-mt-1 mb-2 text-[10px] text-muted-foreground">Tap a surface to mark / clear caries.</p>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="surf in SURFACES"
            :key="`caries-${surf}`"
            type="button"
            class="chip chip-caries capitalize"
            :class="{ 'chip-pressed-caries': isCariesSet(surf) }"
            :aria-pressed="isCariesSet(surf)"
            :disabled="disabled"
            @click="toggleCaries(surf)"
          >
            {{ surf === 'occlusal' && isAnterior ? 'I' : surf.charAt(0).toUpperCase() }}
            <span v-if="cariesSeverity(surf)" class="ml-0.5 text-[8px] uppercase opacity-80">{{ cariesSeverity(surf)?.[0] }}</span>
          </button>
        </div>
        <!-- Severity table: one row per lit surface, each row independently
             editable. v-for over a pre-filtered array gives every <button>
             its own closed-over `surf`, so the click handlers target the
             correct row even when several surfaces are marked. -->
        <div v-if="litCariesSurfaces.length > 0" class="mt-2 flex flex-col gap-1">
          <div
            v-for="surf in litCariesSurfaces"
            :key="`sev-${surf}`"
            class="flex items-center gap-1 text-[11px]"
          >
            <span class="w-10 shrink-0 text-center font-mono font-semibold uppercase tracking-wide text-muted-foreground">
              {{ surf === 'occlusal' && isAnterior ? 'I' : surf.charAt(0).toUpperCase() }}
            </span>
            <button
              v-for="sev in cariesOptions"
              :key="`${surf}-${sev.value}`"
              type="button"
              class="chip-sm flex-1"
              :aria-pressed="cariesSeverity(surf) === sev.value"
              :disabled="disabled"
              @click="setCariesSeverity(surf, sev.value)"
            >{{ sev.label }}</button>
          </div>
        </div>
      </section>

      <!-- Fillings per surface -->
      <section v-if="!hideToothSubstance" class="panel">
        <h4 class="panel-title">Filling</h4>
        <div class="space-y-1.5">
          <div v-for="surf in SURFACES" :key="`fill-${surf}`" class="flex items-center gap-1.5">
            <span class="w-12 text-[11px] uppercase text-muted-foreground">{{ surfaceLabel(surf) }}</span>
            <button
              v-for="mat in fillingOptions"
              :key="`${surf}-${mat.value}`"
              type="button"
              class="chip-sm flex-1"
              :title="mat.label"
              :aria-pressed="fillingMat(surf) === mat.value"
              :disabled="disabled"
              @click="setFilling(surf, mat.value)"
            >{{ mat.short }}</button>
          </div>
          <p class="pt-0.5 text-[9px] text-muted-foreground/70">A=Amalgam · C=Composite · G=GIC · T=Temp</p>
        </div>
      </section>

      <!-- Sealants -->
      <section v-if="!hideToothSubstance" class="panel">
        <h4 class="panel-title">Sealants</h4>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="surf in SURFACES"
            :key="`seal-${surf}`"
            type="button"
            class="chip capitalize"
            :aria-pressed="isSealantOn(surf)"
            :disabled="disabled"
            @click="toggleSealant(surf)"
          >{{ surfaceLabel(surf) }}</button>
        </div>
      </section>

      <!-- Crown -->
      <section v-if="!isMissing" class="panel">
        <h4 class="panel-title">Crown / restoration</h4>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="c in crownOptions"
            :key="c.value"
            type="button"
            class="chip"
            :aria-pressed="state?.crown?.material === c.value"
            :disabled="disabled"
            @click="setCrown(c.value)"
          >{{ c.label }}</button>
        </div>
      </section>

      <!-- Fracture -->
      <section v-if="!hideToothSubstance" class="panel">
        <h4 class="panel-title">Fracture</h4>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="f in fractureOptions"
            :key="f.value"
            type="button"
            class="chip"
            :aria-pressed="state?.fracture?.variant === f.value"
            :disabled="disabled"
            @click="setFracture(f.value)"
          >{{ f.label }}</button>
        </div>
        <Separator class="my-2" />
        <p class="mb-1.5 text-[10px] text-muted-foreground">Bruxism wear</p>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="b in bruxismOptions"
            :key="b.value"
            type="button"
            class="chip"
            :aria-pressed="state?.bruxism?.variant === b.value"
            :disabled="disabled"
            @click="setBruxism(b.value)"
          >{{ b.label }}</button>
        </div>
      </section>

      <!-- Pulp & endo -->
      <section v-if="!hideToothSubstance" class="panel">
        <h4 class="panel-title">Pulp &amp; endo</h4>
        <!-- Pulpitis hides once RCT is recorded — there's no pulp left to inflame. -->
        <button
          v-if="!hasEndoTreatment"
          type="button"
          class="chip mb-2 w-full"
          :aria-pressed="state?.pulpitis?.status === 'existing'"
          :disabled="disabled"
          @click="togglePulpitis"
        >Pulpitis</button>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="e in endoOptions"
            :key="e.value"
            type="button"
            class="chip"
            :aria-pressed="state?.endo?.type === e.value"
            :disabled="disabled"
            @click="setEndo(e.value)"
          >{{ e.label }}</button>
        </div>
        <Separator class="my-2" />
        <p class="mb-1.5 text-[10px] text-muted-foreground">Endo post</p>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="p in postOptions"
            :key="p.value"
            type="button"
            class="chip"
            :aria-pressed="state?.post?.material === p.value"
            :disabled="disabled"
            @click="setPost(p.value)"
          >{{ p.label }}</button>
        </div>
      </section>

      <!-- Implant — only meaningful when the slot is an implant fixture. -->
      <section v-if="showImplantStage" class="panel">
        <h4 class="panel-title">Implant stage</h4>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="i in implantOptions"
            :key="i.value"
            type="button"
            class="chip"
            :aria-pressed="state?.implant?.stage === i.value"
            :disabled="disabled"
            @click="setImplant(i.value)"
          >{{ i.label }}</button>
        </div>
      </section>

      <!-- Bridge -->
      <section class="panel">
        <h4 class="panel-title">Bridge</h4>
        <p class="mb-1.5 text-[10px] text-muted-foreground">Material</p>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="b in bridgeOptions"
            :key="b.value"
            type="button"
            class="chip"
            :aria-pressed="state?.bridge?.material === b.value"
            :disabled="disabled"
            @click="setBridgeMat(b.value)"
          >{{ b.label }}</button>
        </div>
        <div v-if="state?.bridge" class="mt-2 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            class="chip"
            :aria-pressed="state.bridge.role === 'abutment'"
            :disabled="disabled"
            @click="setBridgeRole('abutment')"
          >Abutment</button>
          <button
            type="button"
            class="chip"
            :aria-pressed="state.bridge.role === 'pontic'"
            :disabled="disabled"
            @click="setBridgeRole('pontic')"
          >Pontic</button>
        </div>
      </section>

      <!-- Modifiers -->
      <section class="panel">
        <h4 class="panel-title">Modifiers</h4>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="m in modOptions"
            :key="m.value"
            type="button"
            class="chip"
            :aria-pressed="!!state?.mods?.some((x) => x.kind === m.value)"
            :disabled="disabled"
            @click="toggleMod(m.value)"
          >{{ m.label }}</button>
        </div>
      </section>

      <!-- Plan specials -->
      <section class="panel">
        <h4 class="panel-title">Plan flags</h4>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="s in specialOptions"
            :key="s.value"
            type="button"
            class="chip"
            :aria-pressed="!!state?.specials?.some((x) => x.kind === s.value)"
            :disabled="disabled"
            @click="toggleSpecial(s.value)"
          >{{ s.label }}</button>
        </div>
      </section>

      <!-- Notes -->
      <section class="panel">
        <h4 class="panel-title">Notes</h4>
        <Textarea
          rows="3"
          placeholder="Free-text notes for this tooth…"
          :model-value="state?.notes ?? ''"
          :disabled="disabled"
          @blur="(ev: FocusEvent) => updateNotes((ev.target as HTMLTextAreaElement).value)"
        />
      </section>
    </template>
  </div>
</template>

<style scoped>
.panel {
  padding: 12px;
  border: 1px solid hsl(var(--border, 214 32% 91%));
  border-radius: 14px;
  background: hsl(var(--card, 0 0% 100%));
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.panel-title {
  margin: 0 0 8px 0;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: hsl(var(--muted-foreground, 215 16% 47%));
}
.chip {
  padding: 6px 4px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid hsl(var(--border, 214 32% 91%));
  background: hsl(var(--muted, 210 40% 98%) / 0.4);
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  color: hsl(var(--foreground, 222 47% 11%));
  transition: background 100ms, border-color 100ms;
  user-select: none;
}
.chip:hover { background: hsl(var(--muted, 210 40% 98%)); }
.chip[aria-pressed='true'] {
  background: rgba(59, 123, 255, 0.15);
  border-color: rgba(59, 123, 255, 0.5);
  color: hsl(214, 80%, 35%);
}
.chip:disabled { opacity: 0.5; cursor: not-allowed; }
.chip-sm {
  padding: 3px 4px;
  font-size: 10px;
  font-weight: 600;
  border: 1px solid hsl(var(--border, 214 32% 91%));
  background: hsl(var(--muted, 210 40% 98%) / 0.4);
  border-radius: 6px;
  cursor: pointer;
  text-align: center;
  user-select: none;
}
.chip-sm:hover { background: hsl(var(--muted, 210 40% 98%)); }
.chip-sm[aria-pressed='true'] {
  background: rgba(59, 123, 255, 0.15);
  border-color: rgba(59, 123, 255, 0.5);
  color: hsl(214, 80%, 35%);
}
.chip-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.chip-caries { font-family: ui-monospace, monospace; }
.chip-pressed-caries {
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: rgba(239, 68, 68, 0.5) !important;
  color: #b91c1c !important;
}

/* ── Session findings summary ──────────────────────────────────────── */
.panel-title.mb-0 { margin-bottom: 0; }

.session-row {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 8px;
  align-items: start;
  padding: 6px 8px;
  border: 1px solid hsl(var(--border, 214 32% 91%));
  border-radius: 8px;
  background: hsl(var(--card, 0 0% 100%));
  cursor: pointer;
  transition: background 100ms, border-color 100ms;
  outline: none;
}
.session-row:hover,
.session-row:focus-visible {
  background: hsl(var(--muted, 210 40% 98%));
  border-color: hsl(var(--ring, 215 20% 65%));
}
.session-fdi {
  font-family: ui-monospace, monospace;
  font-size: 13px;
  font-weight: 700;
  color: hsl(var(--foreground, 222 47% 11%));
  text-align: center;
  padding-top: 1px;
}
.session-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.session-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.5;
  border: 1px solid transparent;
  white-space: nowrap;
}
.session-chip[data-tone='caries'] {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.35);
  color: #b91c1c;
}
.session-chip[data-tone='restorative'] {
  background: rgba(59, 123, 255, 0.1);
  border-color: rgba(59, 123, 255, 0.35);
  color: #1d4ed8;
}
.session-chip[data-tone='state'] {
  background: rgba(100, 116, 139, 0.12);
  border-color: rgba(100, 116, 139, 0.35);
  color: #334155;
}
.session-chip[data-tone='plan'] {
  background: rgba(168, 85, 247, 0.12);
  border-color: rgba(168, 85, 247, 0.35);
  color: #6d28d9;
}

/* Body wraps the chip row + the plan-lines list so they stack vertically
 * inside a single grid cell while the FDI sits in its own column. */
.session-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

/* Subtle emerald accent on rows whose findings already have at least one
 * matching procedure on the Plan tab, so the dentist can scan for "still
 * needs treatment" rows at a glance. */
.session-row.has-plan {
  border-color: rgba(16, 185, 129, 0.45);
  background: rgba(16, 185, 129, 0.04);
}

.plan-lines {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 2px 0 0;
  padding: 4px 6px 4px 8px;
  border-left: 2px solid rgba(16, 185, 129, 0.55);
  background: rgba(16, 185, 129, 0.06);
  border-radius: 4px;
}
.plan-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
  font-size: 10px;
  line-height: 1.4;
  color: hsl(var(--foreground, 222 47% 11%));
}
.plan-code {
  font-family: ui-monospace, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(16, 185, 129, 0.18);
  color: rgb(6, 95, 70);
}
:root.dark .plan-code {
  background: rgba(16, 185, 129, 0.22);
  color: rgb(167, 243, 208);
}
.plan-name { font-weight: 600; }
.plan-detail { color: hsl(var(--muted-foreground, 215 16% 47%)); }
.plan-amount {
  margin-left: auto;
  font-family: ui-monospace, monospace;
  font-weight: 700;
  color: hsl(var(--foreground, 222 47% 11%));
}
</style>
