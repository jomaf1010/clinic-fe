<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Crown, Flame, Scissors, X, Zap } from 'lucide-vue-next'
import { Textarea } from '@/components/ui/textarea'
import { isAnteriorFdi } from '../composables/useToothSvg'
import { useToothNumbering } from '../composables/useToothNumbering'
import type {
  StampedToothState,
  ToothSurface,
  CariesSeverity,
  CrownMaterial,
  FractureVariant,
  PerioToothRecord,
  PerioPoint,
} from '../types/dental.types'

/**
 * Floating quick-actions panel that anchors to a clicked tooth (playground
 * parity). Combines:
 *
 *   - 5-surface caries wheel (M / B / D / L / O-or-I) + close button.
 *   - Context bar with 5 icon buttons (Broken / Crown / Missing / Extract /
 *     Pulpitis) using iOS-style gradient styling.
 *   - Expandable sub-panels for fracture variants and crown materials.
 *
 * Every click emits an incremental `Partial<StampedToothState>` delta that
 * the parent merges into `assessment.odontogram_delta` — same channel as the
 * sidebar charting panel + right-click context menu, so all three UIs stay
 * in sync.
 */

interface Props {
  fdi: number | null
  state?: StampedToothState | null
  /** The full 6-point perio record for this tooth — drives perio mode. */
  perioRecord?: PerioToothRecord | null
  /** The cell DOM node to anchor against. Null hides the panel. */
  anchor?: HTMLElement | null
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  state: null,
  perioRecord: null,
  anchor: null,
  disabled: false,
})

const emit = defineEmits<{
  apply: [delta: Partial<StampedToothState>]
  'update-perio': [record: PerioToothRecord]
  close: []
}>()

const { format: formatTooth } = useToothNumbering()
const toothLabel = computed(() => (props.fdi != null ? formatTooth(props.fdi) : ''))

// ── Mode toggle ───────────────────────────────────────────────────────
type Mode = 'caries' | 'perio' | 'note'
const mode = ref<Mode>('caries')
function setMode(m: Mode) { mode.value = m }
// Reset to caries when the tooth changes so the dentist always opens fresh.
watch(() => props.fdi, () => { mode.value = 'caries' })

// ── Position tracking ────────────────────────────────────────────────
const PANEL_W = 248
const PANEL_H = 380
const GAP = 8

const pos = ref<{ x: number; y: number } | null>(null)

// Declared up-front so the immediate watch below can clear it without
// hitting a temporal-dead-zone reference (the playground had the same
// pattern but in a single-file flat-script, so order didn't bite there).
type ContextExpansion = 'fracture' | 'crown' | null
const expansion = ref<ContextExpansion>(null)
function toggleExpansion(which: ContextExpansion) {
  expansion.value = expansion.value === which ? null : which
}

function reanchor() {
  const cell = props.anchor
  if (!cell || !document.body.contains(cell)) {
    pos.value = null
    return
  }
  const rect = cell.getBoundingClientRect()
  // Hide if the cell scrolled out of view entirely.
  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    pos.value = null
    return
  }
  let x = rect.right + GAP
  if (x + PANEL_W > window.innerWidth - 16) x = rect.left - PANEL_W - GAP
  const y = rect.top + rect.height / 2 - PANEL_H / 2
  pos.value = { x, y }
}

watch(() => props.anchor, () => {
  expansion.value = null
  reanchor()
}, { immediate: true })

// Scroll fires at ~60-120Hz on trackpads; getBoundingClientRect inside
// reanchor forces layout each call. rAF-throttle so we run at most once
// per frame.
let scrollRafId: number | null = null
function onScrollOrResize() {
  if (!props.anchor) return
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    if (props.anchor) reanchor()
  })
}

function onDocMouseDown(ev: MouseEvent) {
  if (!props.anchor) return
  const target = ev.target as Element | null
  if (!target) return
  // Class-based check beats template refs across the Teleport boundary —
  // refs on teleported children flip null mid-patch and corrupt vnodes.
  if (target.closest('.quick-panel')) return
  // Don't close if clicking the anchor cell itself — the parent's click
  // toggle on the cell handles select/deselect already.
  if (props.anchor.contains(target)) return
  emit('close')
}

onMounted(() => {
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
  document.addEventListener('mousedown', onDocMouseDown, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
  document.removeEventListener('mousedown', onDocMouseDown, true)
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId)
    scrollRafId = null
  }
})

// ── Wheel geometry ────────────────────────────────────────────────────
const WEDGE_GAP = 3 // degrees of visual gap between wedges
function polarXY(r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: r * Math.cos(rad), y: r * Math.sin(rad) }
}
function wedgePath(startDeg: number, endDeg: number, rOut: number, rIn: number): string {
  const p1 = polarXY(rOut, startDeg)
  const p2 = polarXY(rOut, endDeg)
  const p3 = polarXY(rIn, endDeg)
  const p4 = polarXY(rIn, startDeg)
  return `M ${p1.x} ${p1.y} A ${rOut} ${rOut} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rIn} ${rIn} 0 0 0 ${p4.x} ${p4.y} Z`
}

const isAnterior = computed(() => (props.fdi != null ? isAnteriorFdi(props.fdi) : false))
const isMissing = computed(() => !!props.state?.missing)
const isImplant = computed(() => props.state?.base === 'implant')
const isBridgePontic = computed(() => props.state?.bridge?.role === 'pontic')
const hideToothSubstance = computed(() =>
  isMissing.value || isImplant.value || isBridgePontic.value,
)
const hasEndoTreatment = computed(() => !!props.state?.endo?.type)

// On the chart, the patient's left-side quadrants (2, 3 permanent / 6, 7
// primary) sit to the *right* of midline reading order, so mesial points
// LEFT — swap M/D in the wheel to match.
const isMirroredFdi = computed(() => {
  if (props.fdi == null) return false
  const q = Math.floor(props.fdi / 10)
  return q === 2 || q === 3 || q === 6 || q === 7
})

// Lower-jaw teeth (3, 4 permanent / 7, 8 primary) are drawn upside-down on
// the chart relative to the upper jaw — buccal sits at the BOTTOM of the
// tooth icon and lingual at the top — so the wheel needs to swap B/L.
const isLowerFdi = computed(() => {
  if (props.fdi == null) return false
  const q = Math.floor(props.fdi / 10)
  return q === 3 || q === 4 || q === 7 || q === 8
})

// ── Caries surface wheel ──────────────────────────────────────────────
type WheelSlot = {
  key: ToothSurface
  label: string
  full: string
  /** Centre of the 90° wedge (12 o'clock = 0°, clockwise). */
  angle: number
  isPressed: () => boolean
}

const cariesSlots = computed<WheelSlot[]>(() => {
  const mirrored = isMirroredFdi.value
  const lower = isLowerFdi.value
  const buccalAngle = lower ? 180 : 0
  const lingualAngle = lower ? 0 : 180
  const slots: Array<{ key: ToothSurface; label: string; full: string; angle: number }> = [
    { key: 'buccal', label: 'B', full: isAnterior.value ? 'Labial' : 'Buccal', angle: buccalAngle },
    { key: 'mesial', label: 'M', full: 'Mesial', angle: mirrored ? 270 : 90 },
    { key: 'lingual', label: 'L', full: 'Lingual', angle: lingualAngle },
    { key: 'distal', label: 'D', full: 'Distal', angle: mirrored ? 90 : 270 },
  ]
  return slots.map((s) => ({
    ...s,
    isPressed: () => !!props.state?.caries?.[s.key],
  }))
})

const occlusalSlot = computed(() => ({
  key: 'occlusal' as const,
  label: isAnterior.value ? 'I' : 'O',
  full: isAnterior.value ? 'Incisal' : 'Occlusal',
  isPressed: () => !!props.state?.caries?.occlusal,
}))

const cariesSeverityOptions: Array<{ value: CariesSeverity; label: string }> = [
  { value: 'early', label: 'Early' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
]

const focusedCariesSurface = ref<ToothSurface | null>(null)
const focusedSurfaceLabel = computed(() => {
  if (!focusedCariesSurface.value) return ''
  if (focusedCariesSurface.value === 'occlusal') return occlusalSlot.value.full
  return cariesSlots.value.find((s) => s.key === focusedCariesSurface.value)?.full ?? focusedCariesSurface.value
})

function severityOf(surf: ToothSurface): CariesSeverity | null {
  return (props.state?.caries?.[surf]?.severity as CariesSeverity | undefined) ?? null
}
function severityBadge(surf: ToothSurface): string {
  const sev = severityOf(surf)
  return sev ? sev[0]!.toUpperCase() : ''
}

function toggleCaries(surf: ToothSurface) {
  if (props.disabled) return
  const cur = severityOf(surf)
  const surfaces: Record<string, unknown> = {
    [surf]: cur ? { __remove: true } : { severity: 'moderate' },
  }
  emit('apply', { caries: surfaces as StampedToothState['caries'] })
  focusedCariesSurface.value = cur ? null : surf
}

function setCariesSeverity(sev: CariesSeverity) {
  if (props.disabled || !focusedCariesSurface.value) return
  const surf = focusedCariesSurface.value
  if (severityOf(surf) === sev) return
  const surfaces: Record<string, unknown> = { [surf]: { severity: sev } }
  emit('apply', { caries: surfaces as StampedToothState['caries'] })
}

// Reset focus when the active tooth changes.
watch(() => props.fdi, () => {
  focusedCariesSurface.value = null
})

// ── Perio mode (full-chart fields for this tooth) ────────────────────
function defaultPoint(): PerioPoint { return { pd: null, bop: false } }
function defaultPerio(): PerioToothRecord {
  return {
    facial: [defaultPoint(), defaultPoint(), defaultPoint()],
    lingual: [defaultPoint(), defaultPoint(), defaultPoint()],
    mobility: 0,
  }
}

const perio = computed<PerioToothRecord>(() => props.perioRecord ?? defaultPerio())

function clonePerio(rec: PerioToothRecord): PerioToothRecord {
  return {
    facial: rec.facial.map((p) => ({ ...p })) as PerioToothRecord['facial'],
    lingual: rec.lingual.map((p) => ({ ...p })) as PerioToothRecord['lingual'],
    mobility: rec.mobility,
  }
}

function setPd(face: 'facial' | 'lingual', idx: 0 | 1 | 2, raw: string) {
  if (props.disabled) return
  const n = raw === '' ? null : parseInt(raw, 10)
  const value = n != null && Number.isFinite(n) && n >= 0 && n <= 15 ? n : null
  const next = clonePerio(perio.value)
  next[face][idx].pd = value
  emit('update-perio', next)
}
function toggleBop(face: 'facial' | 'lingual', idx: 0 | 1 | 2) {
  if (props.disabled) return
  const next = clonePerio(perio.value)
  next[face][idx].bop = !next[face][idx].bop
  emit('update-perio', next)
}
// Mobility has two consumers: the SVG painter + sidebar chip read from
// `tooth.mods` (boolean — "has mobility"), and the full perio chart reads
// from `perio_chart[fdi].mobility` (grade 0-3). We treat `mods` as the
// presence flag and `perio.mobility` as the grade detail. The displayed
// grade falls back to `perio.mobility` when mods has it; when mods doesn't,
// we always show 0 regardless of any leftover perio_chart value, so the
// sidebar's mobility-toggle stays authoritative.
const hasMobilityMod = computed(() => !!props.state?.mods?.some((m) => m.kind === 'mobility'))
const displayedMobility = computed<0 | 1 | 2 | 3>(() => {
  if (!hasMobilityMod.value) return 0
  return (perio.value.mobility ?? 0) > 0 ? perio.value.mobility : 1
})

function setMobility(grade: 0 | 1 | 2 | 3) {
  if (props.disabled) return
  const next = clonePerio(perio.value)
  next.mobility = grade
  emit('update-perio', next)
  const wantMod = grade > 0
  if (hasMobilityMod.value !== wantMod) {
    emit('apply', {
      mods: [{ kind: 'mobility', ...(wantMod ? {} : { __remove: true }) }] as never,
    })
  }
}

function pdClass(pd: number | null): string {
  if (pd == null) return ''
  if (pd <= 3) return 'pd-healthy'
  if (pd <= 5) return 'pd-warning'
  return 'pd-severe'
}

// ── Context bar ───────────────────────────────────────────────────────
type ContextItem = {
  key: 'fracture' | 'crown' | 'missing' | 'extract' | 'pulpitis'
  label: string
  icon: typeof Zap
  gradient: string
  expands: ContextExpansion
  isPressed: () => boolean
  run: () => void
}

const contextItems = computed<ContextItem[]>(() => {
  const all: ContextItem[] = [
    {
      key: 'fracture',
      label: 'Broken',
      icon: Zap,
      gradient: 'from-red-500 to-orange-500',
      expands: 'fracture',
      isPressed: () => !!props.state?.fracture,
      run: () => toggleExpansion('fracture'),
    },
    {
      key: 'crown',
      label: 'Crown',
      icon: Crown,
      gradient: 'from-amber-400 to-yellow-500',
      expands: 'crown',
      isPressed: () => !!props.state?.crown,
      run: () => toggleExpansion('crown'),
    },
    {
      key: 'missing',
      label: 'Missing',
      icon: X,
      gradient: 'from-slate-500 to-slate-600',
      expands: null,
      isPressed: () => !!props.state?.missing,
      run: () => toggleMissing(),
    },
    {
      key: 'extract',
      label: 'Extract',
      icon: Scissors,
      gradient: 'from-violet-500 to-purple-500',
      expands: null,
      isPressed: () => !!props.state?.specials?.some((s) => s.kind === 'extraction-plan'),
      run: () => toggleSpecial('extraction-plan'),
    },
    {
      key: 'pulpitis',
      label: 'Pulpitis',
      icon: Flame,
      gradient: 'from-pink-500 to-rose-500',
      expands: null,
      isPressed: () => props.state?.pulpitis?.status === 'existing',
      run: () => togglePulpitis(),
    },
  ]
  // When the tooth is marked missing, only Missing (un-toggle) and Extract
  // (the planning flag) make sense — Broken / Crown / Pulpitis would be
  // applied to a tooth that isn't there.
  if (isMissing.value) {
    return all.filter((i) => i.key === 'missing' || i.key === 'extract')
  }
  // Implant base — hide Missing (mutually exclusive), Broken (titanium
  // doesn't fracture like enamel), and Pulpitis (no pulp). Crown and
  // Extract still apply (implant crown / future explant planning).
  if (isImplant.value) {
    return all.filter((i) => i.key !== 'missing' && i.key !== 'fracture' && i.key !== 'pulpitis')
  }
  // RCT has been recorded — pulp is gone, hide Pulpitis.
  if (hasEndoTreatment.value) {
    return all.filter((i) => i.key !== 'pulpitis')
  }
  return all
})

function toggleMissing() {
  if (props.disabled) return
  const on = !!props.state?.missing
  const delta: Partial<StampedToothState> = {
    missing: on
      ? ({ __remove: true } as never)
      : ({ status: 'existing', source_visit_id: null, recorded_at: null, recorded_by: null, since: null, cause: null } as StampedToothState['missing']),
  }
  if (!on && props.state?.base === 'implant') delta.base = 'tooth'
  // Re-introducing a present tooth while the slot is a pontic is
  // clinically impossible — drop the bridge to keep the invariant.
  if (on && props.state?.bridge?.role === 'pontic') {
    delta.bridge = { __remove: true } as never
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

function toggleSpecial(kind: 'extraction-plan' | 'crown-needed' | 'crown-replace') {
  if (props.disabled) return
  const has = !!props.state?.specials?.some((s) => s.kind === kind)
  emit('apply', { specials: [{ kind, ...(has ? { __remove: true } : {}) }] as never })
}

// ── Sub-panel options ─────────────────────────────────────────────────
const fractureVariants = computed<Array<{ key: FractureVariant; label: string }>>(() => {
  const edge = isAnterior.value ? 'I' : 'O'
  return [
    { key: 'mesial', label: 'M' },
    { key: 'mesial-incisal', label: `M+${edge}` },
    { key: 'incisal', label: edge },
    { key: 'distal-incisal', label: `${edge}+D` },
    { key: 'distal', label: 'D' },
    { key: 'mesial-distal', label: 'M+D' },
    { key: 'mesial-distal-incisal', label: 'ALL' },
  ]
})

const crownMaterials: Array<{ key: CrownMaterial; label: string }> = [
  { key: 'zircon', label: 'Zircon' },
  { key: 'metal', label: 'Metal' },
  { key: 'pfm', label: 'PFM' },
  { key: 'porcelain', label: 'Porcelain' },
  { key: 'emax', label: 'e.max' },
  { key: 'temporary', label: 'Temp' },
]

function setFracture(variant: FractureVariant) {
  if (props.disabled) return
  const same = props.state?.fracture?.variant === variant
  emit('apply', { fracture: same ? ({ __remove: true } as never) : ({ variant } as StampedToothState['fracture']) })
}
function setCrown(material: CrownMaterial) {
  if (props.disabled) return
  const same = props.state?.crown?.material === material
  emit('apply', { crown: same ? ({ __remove: true } as never) : ({ material } as StampedToothState['crown']) })
}

// ── Notes ─────────────────────────────────────────────────────────────
// Local draft so typing isn't blocked by the round-trip; we commit on blur
// (same pattern as the sidebar Textarea).
const noteDraft = ref<string>(props.state?.notes ?? '')
watch(
  () => [props.fdi, props.state?.notes] as const,
  ([, n]) => { noteDraft.value = n ?? '' },
)
function commitNote() {
  if (props.disabled) return
  const next = noteDraft.value.trim()
  const cur = props.state?.notes ?? ''
  if (next === cur) return
  emit('apply', { notes: next || null } as Partial<StampedToothState>)
}

// ── Hover state for tooltips ──────────────────────────────────────────
const hoveredSlot = ref<string | null>(null)
const hoveredCariesSlot = computed(() => {
  if (!hoveredSlot.value || hoveredSlot.value.startsWith('ctx-')) return null
  if (hoveredSlot.value === 'occlusal') return occlusalSlot.value
  return cariesSlots.value.find((s) => s.key === hoveredSlot.value) ?? null
})
const hoveredCtxItem = computed(() => {
  if (!hoveredSlot.value?.startsWith('ctx-')) return null
  return contextItems.value.find((i) => `ctx-${i.key}` === hoveredSlot.value) ?? null
})
</script>

<template>
  <Teleport v-if="fdi != null && pos" to="body">
    <div
      class="quick-panel"
      :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
      @click.stop
      @contextmenu.stop
    >
      <!-- Mode tabs — both visible so the dentist sees the alternative at all times. -->
      <div class="quick-tabs" role="tablist" aria-label="Charting mode">
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'caries'"
          class="quick-tab"
          @click="setMode('caries')"
        >Caries</button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'perio'"
          class="quick-tab"
          @click="setMode('perio')"
        >Perio</button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'note'"
          class="quick-tab"
          @click="setMode('note')"
        >
          Note
          <span v-if="state?.notes" class="quick-tab-dot" aria-hidden="true" />
        </button>
      </div>

      <!-- Manual close button — sits above the wheel without taking a slot. -->
      <button
        type="button"
        class="quick-close"
        aria-label="Close quick actions"
        @click="emit('close')"
      >×</button>
      <!-- ───── Caries mode ───── -->
      <template v-if="mode === 'caries'">
      <!-- Notice banner — same place for any "no natural tooth" state. -->
      <div v-if="hideToothSubstance" class="missing-notice">
        <p class="font-semibold">
          <template v-if="isImplant">Implant in place</template>
          <template v-else-if="isBridgePontic">Bridge pontic</template>
          <template v-else>Tooth marked missing</template>
        </p>
        <p class="text-muted-foreground">
          <template v-if="isImplant">Caries doesn't apply to titanium. Crown, bridge &amp; peri-implant probing stay editable from the sidebar.</template>
          <template v-else-if="isBridgePontic">Natural tooth is replaced by the suspended bridge unit. Switch role to abutment from the sidebar if this tooth is the anchor.</template>
          <template v-else>Surface findings hidden. Use Missing below to un-mark, or set bridge / implant from the sidebar.</template>
        </p>
      </div>

      <!-- Caries surface wheel — B/M/L/D in tooth orientation, O/I in centre -->
      <svg v-if="!hideToothSubstance" viewBox="-80 -80 160 160" width="180" height="180" aria-label="Caries surface wheel">
        <circle cx="0" cy="0" r="74" fill="white" stroke="#cbd5e1" stroke-width="1" />
        <!-- Perimeter wedges -->
        <g v-for="slot in cariesSlots" :key="slot.key">
          <path
            :d="wedgePath(slot.angle - 45 + WEDGE_GAP, slot.angle + 45 - WEDGE_GAP, 70, 34)"
            :class="[
              'wheel-slot',
              {
                'wheel-slot-pressed': slot.isPressed(),
                'wheel-slot-hover': hoveredSlot === slot.key,
              },
            ]"
            @mouseenter="hoveredSlot = slot.key"
            @mouseleave="hoveredSlot = null"
            @click="toggleCaries(slot.key)"
          />
          <text
            :x="polarXY(52, slot.angle).x"
            :y="polarXY(52, slot.angle).y + 5"
            text-anchor="middle"
            class="wheel-label"
          >{{ slot.label }}</text>
          <text
            v-if="severityOf(slot.key)"
            :x="polarXY(52, slot.angle).x"
            :y="polarXY(52, slot.angle).y + 16"
            text-anchor="middle"
            class="wheel-sev-badge"
          >{{ severityBadge(slot.key) }}</text>
        </g>

        <!-- Centre — clickable occlusal/incisal surface -->
        <g
          @mouseenter="hoveredSlot = occlusalSlot.key"
          @mouseleave="hoveredSlot = null"
          @click="toggleCaries(occlusalSlot.key)"
        >
          <circle
            cx="0"
            cy="0"
            r="30"
            :class="['wheel-center', { 'wheel-center-pressed': occlusalSlot.isPressed(), 'wheel-center-hover': hoveredSlot === 'occlusal' }]"
          />
          <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" class="wheel-center-letter">
            {{ occlusalSlot.label }}
          </text>
          <text
            v-if="severityOf('occlusal')"
            x="0"
            y="14"
            text-anchor="middle"
            class="wheel-sev-badge"
          >{{ severityBadge('occlusal') }}</text>
        </g>
      </svg>

      <!-- Caries severity row — follows whichever surface was last touched.
           Label stacks above the button grid so long surface names like
           "Occlusal" / "Lingual" can't overflow into the buttons. -->
      <div v-if="focusedCariesSurface && !hideToothSubstance" class="severity-row">
        <span class="severity-label">{{ focusedSurfaceLabel }}</span>
        <div class="severity-buttons">
          <button
            v-for="sev in cariesSeverityOptions"
            :key="sev.value"
            type="button"
            class="severity-btn"
            :aria-pressed="severityOf(focusedCariesSurface) === sev.value"
            :disabled="disabled"
            @click="setCariesSeverity(sev.value)"
          >{{ sev.label }}</button>
        </div>
      </div>

      <!-- Hover hint -->
      <div class="context-hint">
        <span v-if="hoveredCtxItem">{{ hoveredCtxItem.label }}</span>
        <span v-else-if="hoveredCariesSlot">{{ hoveredCariesSlot.full }}</span>
        <span v-else class="context-hint-muted">#{{ toothLabel }}</span>
      </div>

      <!-- Context bar -->
      <div class="context-bar">
        <button
          v-for="item in contextItems"
          :key="item.key"
          type="button"
          class="context-item bg-gradient-to-br text-white shadow-sm"
          :class="[
            item.gradient,
            {
              'context-item-pressed': item.isPressed(),
              'context-item-expanded': expansion === item.expands && expansion != null,
              'context-item-idle': !item.isPressed() && !(expansion === item.expands && expansion != null),
            },
          ]"
          :title="item.label"
          :aria-label="item.label"
          :disabled="disabled"
          @mouseenter="hoveredSlot = `ctx-${item.key}`"
          @mouseleave="hoveredSlot = null"
          @click="item.run()"
        >
          <component :is="item.icon" :size="18" />
        </button>
      </div>

      <!-- Sub-panel: fracture variants -->
      <div v-if="expansion === 'fracture'" class="sub-panel">
        <div class="sub-panel-title">Fracture</div>
        <div class="sub-panel-grid">
          <button
            v-for="v in fractureVariants"
            :key="v.key"
            type="button"
            class="sub-chip"
            :aria-pressed="state?.fracture?.variant === v.key"
            :disabled="disabled"
            @click="setFracture(v.key)"
          >{{ v.label }}</button>
        </div>
      </div>

      <!-- Sub-panel: crown materials -->
      <div v-else-if="expansion === 'crown'" class="sub-panel">
        <div class="sub-panel-title">Crown material</div>
        <div class="sub-panel-grid">
          <button
            v-for="c in crownMaterials"
            :key="c.key"
            type="button"
            class="sub-chip"
            :aria-pressed="state?.crown?.material === c.key"
            :disabled="disabled"
            @click="setCrown(c.key)"
          >{{ c.label }}</button>
        </div>
      </div>
      </template>

      <!-- ───── Periodontal mode ───── -->
      <template v-else-if="mode === 'perio'">
        <!-- Same gating as the caries wheel — a missing tooth has no socket
             contents to probe, so PD / BOP / mobility all hide. -->
        <div v-if="isMissing" class="missing-notice">
          <p class="font-semibold">Tooth marked missing</p>
          <p class="text-muted-foreground">Periodontal probing doesn't apply. Switch to Caries to un-mark.</p>
        </div>
        <div v-else class="perio-panel">
          <div class="perio-section-title">Pocket Depth (mm)</div>
          <div class="perio-grid">
            <div class="perio-row">
              <span class="perio-row-label">Facial</span>
              <input
                v-for="idx in [0, 1, 2] as const"
                :key="`pf-${idx}`"
                type="number"
                min="0"
                max="15"
                class="pd-input"
                :class="pdClass(perio.facial[idx]!.pd)"
                :value="perio.facial[idx]!.pd ?? ''"
                :disabled="disabled"
                @input="(ev) => setPd('facial', idx, (ev.target as HTMLInputElement).value)"
              >
            </div>
            <div class="perio-row">
              <span class="perio-row-label">{{ isAnterior ? 'Lingual' : 'Lingual' }}</span>
              <input
                v-for="idx in [0, 1, 2] as const"
                :key="`pl-${idx}`"
                type="number"
                min="0"
                max="15"
                class="pd-input"
                :class="pdClass(perio.lingual[idx]!.pd)"
                :value="perio.lingual[idx]!.pd ?? ''"
                :disabled="disabled"
                @input="(ev) => setPd('lingual', idx, (ev.target as HTMLInputElement).value)"
              >
            </div>
          </div>

          <div class="perio-section-title mt-2">Bleeding (BOP)</div>
          <div class="perio-grid">
            <div class="perio-row">
              <span class="perio-row-label">Facial</span>
              <button
                v-for="idx in [0, 1, 2] as const"
                :key="`bf-${idx}`"
                type="button"
                class="bop-dot"
                :class="{ 'bop-on': perio.facial[idx]!.bop }"
                :disabled="disabled"
                :title="`BOP facial ${idx + 1}`"
                @click="toggleBop('facial', idx)"
              />
            </div>
            <div class="perio-row">
              <span class="perio-row-label">Lingual</span>
              <button
                v-for="idx in [0, 1, 2] as const"
                :key="`bl-${idx}`"
                type="button"
                class="bop-dot"
                :class="{ 'bop-on': perio.lingual[idx]!.bop }"
                :disabled="disabled"
                :title="`BOP lingual ${idx + 1}`"
                @click="toggleBop('lingual', idx)"
              />
            </div>
          </div>

          <div class="perio-section-title mt-2">Mobility</div>
          <div class="mobility-grid">
            <button
              v-for="g in [0, 1, 2, 3] as const"
              :key="`mob-${g}`"
              type="button"
              class="mobility-btn"
              :aria-pressed="displayedMobility === g"
              :disabled="disabled"
              @click="setMobility(g)"
            >{{ g === 0 ? '—' : g === 1 ? 'I' : g === 2 ? 'II' : 'III' }}</button>
          </div>
        </div>
      </template>

      <!-- ───── Note mode ───── -->
      <template v-else>
        <div class="note-panel">
          <label class="note-label" :for="`tooth-note-${fdi}`">
            Tooth #{{ toothLabel }} note
          </label>
          <Textarea
            :id="`tooth-note-${fdi}`"
            v-model="noteDraft"
            class="min-h-[110px] resize-y text-xs"
            rows="6"
            placeholder="Free-text notes for this tooth…"
            :disabled="disabled"
            @blur="commitNote"
          />
          <p class="note-hint">Saves on blur. Same field as the sidebar.</p>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.quick-panel {
  position: fixed;
  z-index: 60;
  width: 248px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  /* Top padding clears the absolute-positioned tab strip + close × so the
   * caries wheel and perio inputs both start below them. */
  padding: 34px 10px 10px;
  filter: drop-shadow(0 10px 24px rgba(15, 23, 42, 0.22));
  user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
}
.quick-panel > svg { display: block; }
.quick-tabs {
  position: absolute;
  top: 6px;
  left: 6px;
  display: inline-flex;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 7px;
  padding: 2px;
  gap: 1px;
}
.quick-tab {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: 5px;
  cursor: pointer;
  transition: background 100ms, color 100ms;
}
.quick-tab:hover { color: #1e293b; }
.quick-tab[aria-selected='true'] {
  background: white;
  color: #1d4ed8;
  box-shadow: 0 1px 1px rgba(15, 23, 42, 0.06);
}
.quick-tab-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 9999px;
  background: rgb(249, 115, 22);
  margin-left: 1px;
  box-shadow: 0 0 0 1.5px white;
}

.quick-close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: #94a3b8;
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: background 100ms, color 100ms, border-color 100ms;
}
.quick-close:hover {
  background: #f1f5f9;
  border-color: #e2e8f0;
  color: #1e293b;
}

.context-bar {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 4px;
  width: 100%;
}
.missing-notice {
  width: 180px;
  padding: 10px 12px;
  border: 1px dashed rgba(245, 158, 11, 0.5);
  border-radius: 12px;
  background: rgba(245, 158, 11, 0.08);
  text-align: center;
  font-size: 11px;
  line-height: 1.4;
  color: hsl(var(--foreground, 222 47% 11%));
}
.context-item {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  cursor: pointer;
  min-width: 0;
  overflow: hidden;
  transition: opacity 120ms, box-shadow 120ms, transform 120ms, filter 120ms;
  border: none;
}
.context-item-idle {
  opacity: 0.55;
  filter: saturate(0.9);
}
.context-item-idle:hover {
  opacity: 0.85;
  transform: scale(1.05);
}
.context-item-pressed {
  opacity: 1;
  box-shadow: 0 0 0 2px white, 0 0 0 4px rgba(15, 23, 42, 0.55), 0 2px 6px rgba(0, 0, 0, 0.15);
  transform: scale(1.02);
}
.context-item-expanded {
  opacity: 1;
  box-shadow: 0 0 0 2px white, 0 0 0 4px rgba(59, 123, 255, 0.55), 0 2px 6px rgba(0, 0, 0, 0.15);
}
.context-item:disabled { cursor: not-allowed; opacity: 0.35; }

.context-hint {
  width: 100%;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #0f172a;
  min-height: 14px;
}
.context-hint-muted { color: #94a3b8; }

.sub-panel {
  width: 100%;
  padding: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.sub-panel-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  margin-bottom: 6px;
}
.sub-panel-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.sub-chip {
  padding: 6px 4px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}
.sub-chip:hover { background: #eef2f7; }
.sub-chip[aria-pressed='true'] {
  background: rgba(59, 123, 255, 0.15);
  border-color: rgba(59, 123, 255, 0.5);
  color: #1d4ed8;
}
.sub-chip:disabled { cursor: not-allowed; opacity: 0.5; }

.wheel-slot {
  fill: white;
  stroke: #e2e8f0;
  stroke-width: 1;
  cursor: pointer;
  transition: fill 120ms;
}
.wheel-slot:hover, .wheel-slot.wheel-slot-hover { fill: #f1f5f9; }
.wheel-slot.wheel-slot-pressed {
  fill: rgba(239, 68, 68, 0.2);
  stroke: rgba(239, 68, 68, 0.55);
}
.wheel-slot.wheel-slot-pressed.wheel-slot-hover { fill: rgba(239, 68, 68, 0.35); }
.wheel-center {
  fill: #f8fafc;
  stroke: #e2e8f0;
  cursor: pointer;
  transition: fill 120ms;
}
.wheel-center.wheel-center-hover { fill: #e2e8f0; }
.wheel-center.wheel-center-pressed {
  fill: rgba(239, 68, 68, 0.2);
  stroke: rgba(239, 68, 68, 0.55);
}
.wheel-center.wheel-center-pressed.wheel-center-hover { fill: rgba(239, 68, 68, 0.35); }
.wheel-label {
  font-family: ui-monospace, monospace;
  font-size: 14px;
  font-weight: 700;
  fill: #334155;
  pointer-events: none;
}
.wheel-center-letter {
  font-family: ui-monospace, monospace;
  font-size: 18px;
  font-weight: 700;
  fill: #334155;
  pointer-events: none;
}
.wheel-sev-badge {
  font-family: ui-monospace, monospace;
  font-size: 9px;
  font-weight: 800;
  fill: #b91c1c;
  pointer-events: none;
  letter-spacing: 0.06em;
}

.severity-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}
.severity-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  text-align: center;
}
.severity-buttons {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
}
.severity-btn {
  padding: 5px 4px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}
.severity-btn:hover { background: #eef2f7; }
.severity-btn[aria-pressed='true'] {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.5);
  color: #b91c1c;
}
.severity-btn:disabled { cursor: not-allowed; opacity: 0.5; }

/* ── Perio mode ─────────────────────────────────────────────── */
.perio-panel {
  width: 100%;
  font-family: ui-monospace, 'SF Mono', monospace;
}
.perio-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  margin: 0 0 4px 0;
}
.perio-section-title.mt-2 { margin-top: 10px; }
.perio-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.perio-row {
  display: grid;
  grid-template-columns: 56px repeat(3, minmax(0, 1fr));
  gap: 4px;
  align-items: center;
}
.perio-row-label {
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 10px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.pd-input {
  width: 100%;
  height: 26px;
  padding: 0;
  text-align: center;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #1e293b;
  outline: none;
  -moz-appearance: textfield;
}
.pd-input::-webkit-inner-spin-button,
.pd-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.pd-input:focus {
  border-color: rgb(59, 123, 255);
  box-shadow: 0 0 0 2px rgba(59, 123, 255, 0.2);
}
.pd-input:disabled { opacity: 0.6; cursor: not-allowed; }
.pd-healthy { background: rgba(34, 197, 94, 0.1); color: #15803d; }
.pd-warning { background: rgba(245, 158, 11, 0.18); color: #b45309; border-color: rgba(245, 158, 11, 0.4); }
.pd-severe {
  background: rgba(239, 68, 68, 0.2);
  color: #b91c1c;
  border-color: rgba(239, 68, 68, 0.5);
  font-weight: 800;
}
.bop-dot {
  width: 100%;
  max-width: 14px;
  height: 14px;
  padding: 0;
  border: 1px solid #cbd5e1;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  aspect-ratio: 1/1;
  justify-self: center;
  transition: background 100ms;
}
.bop-dot:hover { background: rgba(148, 163, 184, 0.2); }
.bop-dot:disabled { cursor: not-allowed; opacity: 0.6; }
.bop-dot.bop-on {
  background: rgb(239, 68, 68);
  border-color: #b91c1c;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
}
.mobility-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
}
.mobility-btn {
  padding: 6px 4px;
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 6px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  transition: background 100ms, border-color 100ms, color 100ms;
}
.mobility-btn:hover { background: #eef2f7; }
.mobility-btn[aria-pressed='true'] {
  background: rgba(59, 123, 255, 0.15);
  border-color: rgba(59, 123, 255, 0.5);
  color: #1d4ed8;
}
.mobility-btn:disabled { cursor: not-allowed; opacity: 0.5; }

/* ── Note mode ──────────────────────────────────────────────── */
.note-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.note-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
}
.note-hint {
  font-size: 10px;
  color: #94a3b8;
  text-align: center;
  margin: 0;
}
</style>
