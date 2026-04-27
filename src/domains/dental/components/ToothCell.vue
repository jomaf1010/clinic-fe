<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { buildToothSvg, hasOcclusalView, type ToothView } from '../composables/useToothSvg'
import { useToothNumbering } from '../composables/useToothNumbering'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type {
  StampedToothState,
  ToothSurface,
  TreatmentStatus,
  PerioToothRecord,
} from '../types/dental.types'
import type { ToothDisplayLayer, ToothDisplayState } from '../composables/useDisplayOdontogram'

/**
 * One tooth cell — renders the buccal + (optional) occlusal SVG for one
 * FDI and toggles clinical groups based on either a rich `StampedToothState`
 * (detailed mode) or a `ToothDisplayState` (layer-based mode driven by
 * `useDisplayOdontogram`).
 *
 * Two inputs, one paint pass. Prefer `displayState` for the real-app flow
 * (tri-state derivation); `stampedState` is there for the playground /
 * detail views that want the raw canonical shape.
 */

interface Props {
  fdi: number
  /** Layered display projection — existing + proposed + completed. */
  displayState?: ToothDisplayState | null
  /** Raw stamped shape (optional fallback). */
  stampedState?: StampedToothState | null
  isActive?: boolean
  isSelected?: boolean
  isHovered?: boolean
  showOcclusal?: boolean
  /** Which view(s) to render. `both` keeps the legacy stacked layout. */
  view?: 'buccal' | 'occlusal' | 'both'
  /** Where the FDI label sits. `none` hides it (used for occlusal-only cells). */
  labelPosition?: 'top' | 'bottom' | 'none'
  /** Visual variant — `occlusal` strips padding/background for the mid rows. */
  variant?: 'buccal' | 'occlusal'
  /** Render the red perio indicator dot when this tooth carries any
   *  perio_chart data (PD ≥1, BOP, or mobility > 0). */
  hasPerio?: boolean
  /** Per-tooth perio record — drives the perio-dot summary tooltip. */
  perioRecord?: PerioToothRecord | null
}

const props = withDefaults(defineProps<Props>(), {
  displayState: null,
  stampedState: null,
  isActive: false,
  isSelected: false,
  isHovered: false,
  showOcclusal: true,
  view: 'both',
  labelPosition: 'top',
  variant: 'buccal',
  hasPerio: false,
  perioRecord: null,
})

const { format: formatTooth } = useToothNumbering()
const toothLabel = computed(() => formatTooth(props.fdi))

const perioSummary = computed(() => {
  const r = props.perioRecord
  if (!r) return null
  const pds: number[] = []
  let bop = 0
  for (const face of [r.facial, r.lingual]) {
    for (const p of face ?? []) {
      if (p?.pd != null) pds.push(p.pd)
      if (p?.bop) bop++
    }
  }
  return {
    mobility: r.mobility ?? 0,
    maxPd: pds.length ? Math.max(...pds) : null,
    meanPd: pds.length ? +(pds.reduce((a, b) => a + b, 0) / pds.length).toFixed(1) : null,
    pockets4: pds.filter((d) => d >= 4 && d < 6).length,
    pockets6: pds.filter((d) => d >= 6).length,
    bop,
    pdCount: pds.length,
  }
})

const mobilityRoman = (g: number): string => (g === 1 ? 'I' : g === 2 ? 'II' : g === 3 ? 'III' : '—')

defineEmits<{
  click: [event: MouseEvent]
  'click-surface': [surface: ToothSurface]
  hover: [hovering: boolean]
}>()

const buccalHost = ref<HTMLElement | null>(null)
const occlusalHost = ref<HTMLElement | null>(null)

const showBuccal = computed(() => props.view === 'buccal' || props.view === 'both')
const showOcclusalView = computed(() => props.view === 'occlusal' || (props.view === 'both' && props.showOcclusal))
const buccalSvg = computed(() => (showBuccal.value ? buildToothSvg(props.fdi, 'buccal') : ''))
const occlusalSvg = computed(() => (showOcclusalView.value ? buildToothSvg(props.fdi, 'occlusal') : ''))
const occlusalAvailable = computed(() => showOcclusalView.value && hasOcclusalView(props.fdi))

function setActive(root: Element | null, selector: string, on: boolean): boolean {
  if (!root) return false
  const el = root.querySelector(selector)
  if (!el) return false
  el.setAttribute('data-active', on ? '1' : '0')
  return true
}

/** Prefer display state; fall back to stamped state. */
const effectiveLayers = computed<ToothDisplayLayer[]>(() => props.displayState?.layers ?? [])

function findLayer(field: string, surface?: ToothSurface): ToothDisplayLayer | undefined {
  return effectiveLayers.value.find((l) => l.field === field && l.surface === surface)
}

function primaryStatus(): TreatmentStatus {
  // Completed > proposed > existing. Drives the tooth-level `data-treatment`.
  const layers = effectiveLayers.value
  if (layers.some((l) => l.status === 'completed')) return 'completed'
  if (layers.some((l) => l.status === 'proposed')) return 'proposed'
  return 'existing'
}

/** Apply clinical state to one view's SVG (buccal or occlusal). */
function paintView(host: HTMLElement | null, _view: ToothView): void {
  if (!host) return
  const svg = host.querySelector('svg[data-tooth]')
  if (!svg) return

  const display = props.displayState
  const stamped = props.stampedState

  svg.setAttribute('data-treatment', primaryStatus())

  const missingLayer = display?.missing ?? (stamped?.missing ? { status: stamped.missing.status } : null)
  const base: string = display?.base ?? stamped?.base ?? 'tooth'
  const toothIsHidden = missingLayer?.status === 'existing'

  // Silhouette variants visually replace the normal tooth outline
  const fracture = findLayer('fracture') ?? (stamped?.fracture ? { field: 'fracture', label: stamped.fracture.variant, status: stamped.fracture.status } as ToothDisplayLayer : undefined)
  const hasSilhouetteVariant = !!fracture

  // ---- Base dentition (playground parity) ----
  setActive(svg, '#tooth', base === 'tooth' && !toothIsHidden && !hasSilhouetteVariant)
  setActive(svg, '#milktooth', base === 'milktooth' && !toothIsHidden && !hasSilhouetteVariant)
  // The `#missing-closed` group is the heavy black X in the asset; when
  // there's a bridge on this slot the X stacks on top of the connector
  // and prosthesis overlay, making the visual unreadable. Skip it in that
  // case and let the bridge graphics carry the "no natural tooth" cue
  // (we'll render a CSS-only missing indicator on the cell wrapper instead).
  const hasBridge = !!stamped?.bridge
  setActive(svg, '#missing-closed', missingLayer?.status === 'existing' && !hasBridge)
  // Show the extraction-plan X when EITHER the missing layer is staged as
  // 'proposed' (legacy path) OR the dentist flagged the tooth for
  // extraction via the per-tooth specials list (sidebar / context-menu /
  // quick-actions write here, not into `missing.status`).
  const hasExtractionPlan = (stamped?.specials ?? []).some((s) => s.kind === 'extraction-plan')
  setActive(svg, '#extraction-plan', (missingLayer?.status === 'proposed' || hasExtractionPlan) && !hasBridge)
  setActive(svg, '#implant', base === 'implant')

  // Implant stages
  const implantLayer = stamped?.implant
  if (implantLayer) {
    setActive(svg, '#implant-base', true)
    setActive(svg, '#implant-healing-abutment', implantLayer.stage === 'healing-abutment')
    setActive(svg, '#implant-bar', implantLayer.stage === 'bar')
    setActive(svg, '#implant-locator-screw', implantLayer.stage === 'locator-screw')
  }

  // ---- Fracture (silhouette variant) ----
  const fractureVariants = [
    'mesial', 'distal', 'inicisal', 'mesial-distal',
    'mesial-inicisal', 'distal-inicisal', 'mesial-distal-inicisal',
  ]
  // Accept both `incisal` (canonical) and `inicisal` (ZoliQua id typo)
  const fractureVariant = stamped?.fracture?.variant
    ? (stamped.fracture.variant === 'incisal' ? 'inicisal' : stamped.fracture.variant).replace('incisal', 'inicisal')
    : null
  for (const v of fractureVariants) {
    setActive(svg, `#tooth-broken-${v}`, fractureVariant === v)
  }

  // ---- Pulp ----
  const pulpitis = stamped?.pulpitis?.status === 'existing'
  const milkPrefix = base === 'milktooth' ? 'milktooth' : 'tooth'
  setActive(svg, `#${milkPrefix}-inflam-pulp`, pulpitis && !toothIsHidden)
  setActive(svg, `#${milkPrefix}-healthy-pulp`, !pulpitis && !toothIsHidden)

  // ---- Per-surface caries + fillings ----
  const surfaces: ToothSurface[] = ['mesial', 'distal', 'occlusal', 'buccal', 'lingual']
  for (const surf of surfaces) {
    const cariesLeaf = stamped?.caries?.[surf]
    setActive(svg, `#caries-${surf}`, !!cariesLeaf)

    const fillingLeaf = stamped?.fillings?.[surf]
    const materials = ['amalgam', 'composite', 'gic', 'temporary'] as const
    for (const mat of materials) {
      const wantsThisMat = fillingLeaf?.material === (mat === 'gic' ? 'glass_ionomer' : mat)
      setActive(svg, `#filling-${mat}-${surf}`, !!wantsThisMat)
    }
  }

  // Sealants
  const hasSealant = !!(stamped?.sealants && Object.keys(stamped.sealants).length > 0)
  setActive(svg, '#fissure-sealing', hasSealant)
  setActive(svg, '#fissure-sealing-occlusal', hasSealant)

  // ---- Crown / restoration ----
  const crownMat = stamped?.crown?.material ?? null
  const crowns = ['zircon', 'metal', 'emax', 'temporary', 'telescope']
  for (const c of crowns) setActive(svg, `#restorations #${c}`, crownMat === c)

  // ---- Endo ----
  const endoType = stamped?.endo?.type ?? null
  const endos = ['endo-filling', 'endo-filling-incomplete', 'endo-resection']
  for (const e of endos) setActive(svg, `#endos #${e}`, endoType === e)
  const post = stamped?.post?.material ?? null
  setActive(svg, '#endos #endo-glass-pin', post === 'glass')
  setActive(svg, '#endos #endo-metal-pin', post === 'metal')

  // ---- Bruxism ----
  const bruxism = stamped?.bruxism?.variant ?? null
  setActive(svg, '#tooth-bruxism-wear', bruxism === 'wear' || bruxism === 'both')
  setActive(svg, '#tooth-bruxism-neck-wear', bruxism === 'neck-wear' || bruxism === 'both')

  // ---- Mods (inflammation, mobility) ----
  const mods = stamped?.mods ?? []
  const hasInfInside = mods.some((m) => m.kind === 'inflammation-inside')
  const hasInfOutside = mods.some((m) => m.kind === 'inflammation-outside')
  setActive(svg, '#inflammation', hasInfInside || hasInfOutside)
  setActive(svg, '#inflammation-inside', hasInfInside)
  setActive(svg, '#inflammation-outside', hasInfOutside)
  setActive(svg, '#mobility', mods.some((m) => m.kind === 'mobility'))

  // ---- Plan specials ----
  const specials = stamped?.specials ?? []
  setActive(svg, '#crown-needed', specials.some((s) => s.kind === 'crown-needed'))
  setActive(svg, '#crown-replace', specials.some((s) => s.kind === 'crown-replace'))

  // ---- Bridge ----
  // The ZoliQua templates ship with two ID conventions for bridge paths:
  //   - `{mat}-bridge-connector` — used by all "fixed" materials
  //     (zircon / metal / telescope / temporary) on every template, and by
  //     the molar-occlusal prosthesis (16_occl) only.
  //   - `{mat}-connector` — used by `prosthesis` on every template *except*
  //     16_occl.svg.
  // Plus a `{mat}-crown` shape that covers the pontic / abutment crown
  // form on every template.
  //
  // We tag every variant with its desired state on every repaint so:
  //   1. switching material clears the previous one,
  //   2. removing the bridge clears all of them, and
  //   3. defaults-visible paths in 16_occl.svg (asset bug — prosthesis
  //      paths there ship without `display:none`) get explicitly hidden
  //      when no bridge is set.
  const bridge = stamped?.bridge ?? null
  const bridgeMat = bridge?.material ?? null
  for (const m of ['zircon', 'metal', 'telescope', 'temporary', 'prosthesis'] as const) {
    const on = bridgeMat === m
    setActive(svg, `#${m}-bridge-connector`, on)
    setActive(svg, `#${m}-connector`, on)
    setActive(svg, `#${m}-crown`, on)
  }
  // Group wrappers — harmless when not used by the template, useful when
  // the SVG nests crown sub-paths (e.g. telescope-crown-outside / -inside).
  setActive(svg, '#prosthesis', bridgeMat === 'prosthesis')
  setActive(svg, '#telescope', bridgeMat === 'telescope')
}

function paint(): void {
  if (showBuccal.value) paintView(buccalHost.value, 'buccal')
  if (occlusalAvailable.value) paintView(occlusalHost.value, 'occlusal')
}

onMounted(paint)
// Reference-only watch is sufficient — the parent rebuilds new
// `displayState` / `stampedState` references whenever the merged
// odontogram recomputes, so Vue's prop diff catches changes in O(1)
// per cell. With 32 cells re-rendering on every PD keystroke, the
// previous `{ deep: true }` walked the whole stamped object 32× per
// keystroke for no extra signal.
watch(
  () => [props.displayState, props.stampedState] as const,
  paint,
)
watch(() => props.fdi, () => {
  // SVG markup is re-rendered via v-html on fdi change; wait a tick.
  queueMicrotask(paint)
})
</script>

<template>
  <div
    class="tooth-cell"
    :class="[
      `variant-${variant}`,
      `label-${labelPosition}`,
      {
        'is-active': isActive,
        'is-selected': isSelected,
        'is-hovered': isHovered,
        // Stamped path drives the chart while editing; display path
        // drives read-only callers (history snapshots, projected
        // profile views). Either signal qualifies.
        'is-missing': !!stampedState?.missing || displayState?.missing?.status === 'existing',
      },
    ]"
    role="button"
    :aria-label="`Tooth ${toothLabel}`"
    @click="$emit('click', $event)"
    @mouseenter="$emit('hover', true)"
    @mouseleave="$emit('hover', false)"
  >
    <span v-if="labelPosition === 'top'" class="fdi-label">{{ toothLabel }}</span>
    <div v-if="showBuccal && buccalSvg" ref="buccalHost" class="tooth-svg tooth-svg-buccal" v-html="buccalSvg" />
    <div v-if="occlusalAvailable && occlusalSvg" ref="occlusalHost" class="tooth-svg tooth-svg-occlusal" v-html="occlusalSvg" />
    <span v-if="labelPosition === 'bottom'" class="fdi-label">{{ toothLabel }}</span>
    <!-- Notes indicator (orange) on the right and perio indicator (red) on
         the left of the buccal rows only, so the occlusal middle rows stay
         uncluttered. Both flip to the bottom corner on the lower buccal row
         to keep them off the FDI label. -->
    <TooltipProvider v-if="stampedState?.notes && variant === 'buccal'" :delay-duration="150">
      <Tooltip>
        <TooltipTrigger as-child>
          <span
            class="note-dot note-dot-right"
            :class="labelPosition === 'bottom' ? 'note-dot-lower' : 'note-dot-upper'"
            aria-label="Has notes"
            tabindex="0"
            @click.stop
          />
        </TooltipTrigger>
        <TooltipContent side="top" class="max-w-[240px] whitespace-pre-wrap text-xs leading-snug">
          <p class="mb-0.5 font-semibold">Tooth {{ toothLabel }} notes</p>
          <p class="font-normal text-muted-foreground">{{ stampedState.notes }}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
    <!-- Hide the perio indicator on a missing tooth — `perio_chart`
         entries from before the tooth was extracted linger and would
         otherwise paint a red dot on an empty socket. -->
    <TooltipProvider v-if="hasPerio && variant === 'buccal' && !stampedState?.missing" :delay-duration="150">
      <Tooltip>
        <TooltipTrigger as-child>
          <span
            class="perio-dot"
            :class="labelPosition === 'bottom' ? 'note-dot-lower' : 'note-dot-upper'"
            aria-label="Has perio data"
            tabindex="0"
            @click.stop
          />
        </TooltipTrigger>
        <TooltipContent side="top" class="max-w-[260px] text-xs leading-snug">
          <p class="mb-1 font-semibold">Tooth {{ toothLabel }} · perio</p>
          <div v-if="perioSummary" class="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
            <span class="text-muted-foreground">Mobility</span>
            <span :class="perioSummary.mobility > 0 ? 'font-semibold' : 'text-muted-foreground'">
              {{ mobilityRoman(perioSummary.mobility) }}
            </span>
            <template v-if="perioSummary.pdCount > 0">
              <span class="text-muted-foreground">Max PD</span>
              <span :class="(perioSummary.maxPd ?? 0) >= 6 ? 'text-red-600 font-semibold' : (perioSummary.maxPd ?? 0) >= 4 ? 'text-amber-600 font-semibold' : 'font-semibold'">
                {{ perioSummary.maxPd }} mm
              </span>
              <span class="text-muted-foreground">Mean PD</span>
              <span class="font-semibold">{{ perioSummary.meanPd }} mm</span>
              <span class="text-muted-foreground">Pockets ≥4 / ≥6</span>
              <span>
                <span :class="perioSummary.pockets4 ? 'text-amber-600 font-semibold' : 'text-muted-foreground'">{{ perioSummary.pockets4 }}</span>
                <span class="text-muted-foreground"> / </span>
                <span :class="perioSummary.pockets6 ? 'text-red-600 font-semibold' : 'text-muted-foreground'">{{ perioSummary.pockets6 }}</span>
              </span>
            </template>
            <span class="text-muted-foreground">BOP sites</span>
            <span :class="perioSummary.bop ? 'text-red-600 font-semibold' : 'text-muted-foreground'">
              {{ perioSummary.bop }} / 6
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>

<style scoped>
.tooth-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 2px;
  background: #fffbea;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  min-height: 96px;
  transition: background 120ms, border-color 120ms, box-shadow 120ms;
  user-select: none;
}
/* Upper buccal → label at top, svg hugs bottom */
.tooth-cell.label-top { justify-content: flex-end; }
/* Lower buccal → svg at top, label hugs below */
.tooth-cell.label-bottom { justify-content: flex-start; }
/* Mid rows → occlusal-only, no padding, smaller */
.tooth-cell.variant-occlusal {
  min-height: 64px;
  padding: 2px;
  background: #ffffff;
  justify-content: center;
}
.tooth-cell:hover,
.tooth-cell.is-hovered { background: #fff4cc; border-color: rgba(59, 123, 255, 0.25); }
.tooth-cell.variant-occlusal:hover,
.tooth-cell.variant-occlusal.is-hovered { background: #f1f5f9; border-color: rgba(59, 123, 255, 0.25); }
.tooth-cell.is-active { outline: 2px solid rgb(59, 123, 255); outline-offset: -2px; }
.tooth-cell.is-selected { background: #e6f0ff; border-color: rgba(59, 123, 255, 0.6); }
.fdi-label {
  font-size: 10px;
  color: #64748b;
  line-height: 1;
}
.tooth-svg {
  display: block;
  width: 100%;
}
.tooth-svg :deep(svg) {
  width: 100%;
  height: auto;
  display: block;
  max-height: 84px;
}
.tooth-svg-occlusal :deep(svg) { max-height: 54px; }
/* Missing indicator — replaces the heavy black X (#missing-closed) that
 * was overlaying onto bridge connectors. Subtle ghost: greyed cell, dashed
 * border, strikethrough on the FDI label. Bridge connectors (lower band of
 * the cell) stay clearly visible. */
.tooth-cell.is-missing {
  background: repeating-linear-gradient(
    135deg,
    transparent,
    transparent 6px,
    rgba(148, 163, 184, 0.18) 6px,
    rgba(148, 163, 184, 0.18) 7px
  );
}
/* The dashed missing-border lives on a pseudo-element so it doesn't
 * compete with the `.is-active` outline (which is a real CSS outline) —
 * both can render simultaneously on a tooth that's both missing AND
 * currently selected on the chart. */
.tooth-cell.is-missing::before {
  content: '';
  position: absolute;
  inset: 1px;
  border: 1px dashed rgba(100, 116, 139, 0.5);
  border-radius: 9px;
  pointer-events: none;
}
.tooth-cell.is-missing .fdi-label {
  text-decoration: line-through;
  text-decoration-color: rgba(220, 38, 38, 0.7);
  text-decoration-thickness: 1.5px;
  color: rgba(100, 116, 139, 0.85);
}
.tooth-cell.is-missing .tooth-svg-buccal,
.tooth-cell.is-missing .tooth-svg-occlusal {
  /* Faded so any remaining bridge / implant graphics still show through
   * but the tooth obviously reads as "not really there". */
  opacity: 0.78;
}
.note-dot,
.perio-dot {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 999px;
}
.note-dot {
  background: rgb(251, 146, 60);
  box-shadow: 0 0 0 2px rgba(251, 146, 60, 0.25);
  /* Hover/focus must stay enabled so the notes tooltip can fire. The
   * trigger uses `@click.stop` so the underlying tooth cell still gets
   * its select-tooth click as expected. */
  cursor: help;
}
.perio-dot {
  background: rgb(239, 68, 68);
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
  left: 4px;
  cursor: help;
}
.note-dot-right { right: 4px; }
.note-dot-upper { top: 4px; }
.note-dot-lower { bottom: 4px; }
.tooth-svg :deep(svg #implant path[id*="connector"]),
.tooth-svg :deep(svg #implant path[id*="bar"]),
.tooth-svg :deep(svg #implant path[id*="locator"]) {
  stroke: #475569 !important;
}
/* Proposed treatments render dashed / muted */
.tooth-svg :deep(svg[data-treatment='proposed']) {
  filter: saturate(0.35) opacity(0.65);
}
.tooth-svg :deep(svg[data-treatment='proposed']) g[data-active='1'] path {
  stroke-dasharray: 1.4 1.2;
}
/* Completed treatments: shift hue so today's work pops */
.tooth-svg :deep(svg[data-treatment='completed']) {
  filter: hue-rotate(80deg) saturate(1.2);
}
</style>
