<script setup lang="ts">
/**
 * Real-life arch-shape dental chart with surface selector.
 *
 * Layout:
 *   - Upper & lower teeth distributed along elliptical arcs (maxillary / mandibular).
 *   - Each tooth is an SVG donut split into 4 surface arcs (Buccal, Mesial,
 *     Lingual, Distal) around a central Occlusal circle.
 *   - Clicking a surface toggles it. Clicking the tooth (outside surfaces)
 *     selects it — a floating center panel shows a larger view with surface
 *     pills and the MOD-style code.
 *
 * Ported from `notes/dental-chart.jsx` (React) with typed Vue 3 + our
 * ToothState model. Emits:
 *   - select(fdi)                  — tooth selected (for full-edit dialog)
 *   - surface-toggle(fdi, surface) — a surface was clicked
 *
 * The parent merges surface toggles into the per-visit `odontogramDelta` and
 * saves. Full clinical state (caries, restoration, missing, etc.) continues
 * to be edited through ToothEditDialog — the floating panel has an
 * "Edit details" button that opens it.
 */
import { computed, ref } from 'vue'
import { X, PencilLine } from 'lucide-vue-next'
import {
  PERMANENT_UPPER, PERMANENT_LOWER, PRIMARY_UPPER, PRIMARY_LOWER,
  getArchPositions, toothLabel, SURFACE_CODES, SURFACES_ORDER,
} from '../composables/useFdiTeeth'
import type { Odontogram, ToothState, ToothSurface } from '../types/dental.types'

const props = defineProps<{
  modelValue: Odontogram
  showPrimary?: boolean
  readonly?: boolean
  selected?: string | null
}>()

const emit = defineEmits<{
  select: [fdi: string]
  'surface-toggle': [fdi: string, surface: ToothSurface]
  'edit-details': [fdi: string]
}>()

// ── Local selection state (mirrors parent, overrides w/ internal tap) ────
const internalSelected = ref<string | null>(null)
const selectedFdi = computed(() => props.selected ?? internalSelected.value)

function setSelected(fdi: string | null) {
  internalSelected.value = fdi
  if (fdi !== null) emit('select', fdi)
}

// ── Arch geometry ────────────────────────────────────────────────────────
// Permanent / primary mode. Primary arch is tighter (smaller radii).
const isPrimaryMode = computed(() => !!props.showPrimary)
const upperTeeth = computed(() => (isPrimaryMode.value ? PRIMARY_UPPER : PERMANENT_UPPER))
const lowerTeeth = computed(() => (isPrimaryMode.value ? PRIMARY_LOWER : PERMANENT_LOWER))

// The two arches must NOT cross at the anterior (midline). With archRy=90,
// each arch curves 90 px toward the other; we keep their centres 240 px
// apart so incisor apexes stay 60 px clear of each other (enough room for
// the FDI labels between them).
const W = 540
const H = 480
const archRx = computed(() => (isPrimaryMode.value ? 170 : 220))
const archRy = computed(() => (isPrimaryMode.value ? 70 : 90))
const UPPER_CY = 120
const LOWER_CY = H - 120 // = 360
const toothSize = computed(() => (isPrimaryMode.value ? 26 : 30))

const upperPositions = computed(() =>
  getArchPositions(upperTeeth.value, W / 2, UPPER_CY, archRx.value, archRy.value, true),
)
const lowerPositions = computed(() =>
  getArchPositions(lowerTeeth.value, W / 2, LOWER_CY, archRx.value, archRy.value, false),
)

// ── Per-tooth SVG path geometry (5 surfaces) ─────────────────────────────
// Geometry depends on the current toothSize (permanent vs primary), so we
// recompute the paths reactively.
const r = computed(() => toothSize.value / 2)
const outerR = computed(() => r.value * 0.88)
const innerR = computed(() => r.value * 0.34)
const gapR = computed(() => innerR.value + r.value * 0.05)
const gap = 5

function toRad(d: number): number {
  return (d * Math.PI) / 180
}

function pt(rad: number, deg: number) {
  return { x: r.value + rad * Math.cos(toRad(deg)), y: r.value - rad * Math.sin(toRad(deg)) }
}

function makeArc(s: number, e: number): string {
  const s1 = s + gap
  const e1 = e - gap
  const oS = pt(outerR.value, s1)
  const oE = pt(outerR.value, e1)
  const iE = pt(gapR.value, e1)
  const iS = pt(gapR.value, s1)
  return `M ${oS.x} ${oS.y} A ${outerR.value} ${outerR.value} 0 0 1 ${oE.x} ${oE.y} L ${iE.x} ${iE.y} A ${gapR.value} ${gapR.value} 0 0 0 ${iS.x} ${iS.y} Z`
}

const surfacePaths = computed<Record<ToothSurface, string>>(() => {
  // Reference r/innerR for occlusal circle
  const rv = r.value
  const iv = innerR.value
  return {
    buccal: makeArc(45, 135),
    mesial: makeArc(135, 225),
    lingual: makeArc(225, 315),
    distal: makeArc(315, 405),
    occlusal: `M ${rv + iv} ${rv} A ${iv} ${iv} 0 1 1 ${rv - iv} ${rv} A ${iv} ${iv} 0 1 1 ${rv + iv} ${rv} Z`,
  }
})

// ── Tooth state helpers ──────────────────────────────────────────────────
function getTooth(fdi: string): ToothState | undefined {
  return props.modelValue?.[fdi]
}

function hasData(fdi: string): boolean {
  const t = getTooth(fdi)
  if (!t) return false
  return !!(
    t.caries || t.restoration || t.fracture || t.missing || t.sealant
    || (t.surfaces && Object.values(t.surfaces).some(Boolean))
  )
}

function isSurfaceActive(fdi: string, surface: ToothSurface): boolean {
  return !!getTooth(fdi)?.surfaces?.[surface]
}

function isMissing(fdi: string): boolean {
  return !!getTooth(fdi)?.missing
}

// Severity fill for the surfaces when no explicit surface marker set —
// caries-based hint so the chart reflects the existing clinical state.
function toothFill(fdi: string, surfaceActive: boolean, selected: boolean): string {
  if (surfaceActive) return '#3b7ddd'
  const t = getTooth(fdi)
  if (!t) return selected ? '#e8eef8' : '#edf0f4'
  if (t.missing) return '#e5e7eb'
  if (t.caries === 'severe') return '#fecaca'
  if (t.caries === 'moderate') return '#fed7aa'
  if (t.caries === 'early') return '#fef3c7'
  if (t.caries === 'treated' || t.restoration) return '#dbeafe'
  return selected ? '#e8eef8' : '#edf0f4'
}
function toothStroke(fdi: string, surfaceActive: boolean, selected: boolean): string {
  if (surfaceActive) return '#3b7ddd'
  const t = getTooth(fdi)
  if (!t) return selected ? '#a0b4d8' : '#d0d5e0'
  if (t.missing) return '#9ca3af'
  if (t.caries === 'severe') return '#f87171'
  if (t.caries === 'moderate') return '#fb923c'
  if (t.caries === 'early') return '#fbbf24'
  if (t.caries === 'treated' || t.restoration) return '#93c5fd'
  return selected ? '#a0b4d8' : '#d0d5e0'
}

// ── Click handlers ───────────────────────────────────────────────────────
function onToothClick(fdi: string) {
  if (props.readonly) return
  setSelected(selectedFdi.value === fdi ? null : fdi)
}

function onSurfaceClick(fdi: string, surface: ToothSurface) {
  if (props.readonly) return
  setSelected(fdi)
  emit('surface-toggle', fdi, surface)
}

function closePanel() {
  setSelected(null)
}

// ── Center-panel geometry ────────────────────────────────────────────────
const PANEL_SIZE = 180
const PC = PANEL_SIZE / 2
const P_OUTER = 72
const P_INNER = 27
const P_GAP_R = P_INNER + 3
const P_GAP = 3

function pPt(rad: number, deg: number) {
  return { x: PC + rad * Math.cos(toRad(deg)), y: PC - rad * Math.sin(toRad(deg)) }
}
function pArc(s: number, e: number): string {
  const s1 = s + P_GAP
  const e1 = e - P_GAP
  const oS = pPt(P_OUTER, s1)
  const oE = pPt(P_OUTER, e1)
  const iE = pPt(P_GAP_R, e1)
  const iS = pPt(P_GAP_R, s1)
  return `M ${oS.x} ${oS.y} A ${P_OUTER} ${P_OUTER} 0 0 1 ${oE.x} ${oE.y} L ${iE.x} ${iE.y} A ${P_GAP_R} ${P_GAP_R} 0 0 0 ${iS.x} ${iS.y} Z`
}

const PANEL_PATHS: Record<ToothSurface, string> = {
  buccal: pArc(45, 135),
  mesial: pArc(135, 225),
  lingual: pArc(225, 315),
  distal: pArc(315, 405),
  occlusal: `M ${PC + P_INNER} ${PC} A ${P_INNER} ${P_INNER} 0 1 1 ${PC - P_INNER} ${PC} A ${P_INNER} ${P_INNER} 0 1 1 ${PC + P_INNER} ${PC} Z`,
}
const PANEL_LABEL_R = (P_OUTER + P_GAP_R) / 2
const PANEL_LABEL_POS: Record<Exclude<ToothSurface, 'occlusal'>, { x: number; y: number }> = {
  buccal: pPt(PANEL_LABEL_R, 90),
  mesial: pPt(PANEL_LABEL_R, 180),
  lingual: pPt(PANEL_LABEL_R, 270),
  distal: pPt(PANEL_LABEL_R, 0),
}

function surfaceCode(fdi: string): string {
  const s = getTooth(fdi)?.surfaces ?? {}
  return SURFACES_ORDER.filter((k) => s[k]).map((k) => SURFACE_CODES[k]).join('')
}

function openDetails() {
  if (!selectedFdi.value) return
  emit('edit-details', selectedFdi.value)
}
</script>

<template>
  <div class="relative mx-auto w-full max-w-[500px] select-none">
    <div class="rounded-3xl border bg-card px-4 pt-5 pb-3 shadow-sm">
      <div class="mb-1 text-center">
        <p class="text-sm font-bold tracking-tight">Dental Chart</p>
        <p class="mt-0.5 text-[10px] font-medium text-muted-foreground">
          FDI Notation · Tap tooth → select surfaces
        </p>
      </div>

      <div class="relative mx-auto" :style="{ width: `${W}px`, height: `${H}px` }">
        <svg
          :width="W"
          :height="H"
          :viewBox="`0 0 ${W} ${H}`"
          class="absolute top-0 left-0 block"
        >
          <!-- Arch guides -->
          <ellipse
            :cx="W / 2" :cy="UPPER_CY"
            :rx="archRx + 30" :ry="archRy + 24"
            fill="none" stroke="rgba(59,125,221,0.06)" stroke-width="1"
            stroke-dasharray="4 8"
          />
          <ellipse
            :cx="W / 2" :cy="LOWER_CY"
            :rx="archRx + 30" :ry="archRy + 24"
            fill="none" stroke="rgba(59,125,221,0.06)" stroke-width="1"
            stroke-dasharray="4 8"
          />
          <!-- Midline -->
          <line
            :x1="W / 2" :y1="20" :x2="W / 2" :y2="H - 20"
            stroke="rgba(59,125,221,0.08)" stroke-width="1"
            stroke-dasharray="3 6"
          />

          <!-- Jaw labels -->
          <text :x="W / 2" :y="16" text-anchor="middle" fill="#c4c9d4" font-size="8" font-weight="700" letter-spacing="0.12em" style="text-transform: uppercase">Maxillary</text>
          <text :x="W / 2" :y="H - 6" text-anchor="middle" fill="#c4c9d4" font-size="8" font-weight="700" letter-spacing="0.12em" style="text-transform: uppercase">Mandibular</text>

          <!-- Right / Left -->
          <text x="12" :y="H / 2 + 3" text-anchor="start" fill="#c4c9d4" font-size="8" font-weight="600" letter-spacing="0.08em">R</text>
          <text :x="W - 12" :y="H / 2 + 3" text-anchor="end" fill="#c4c9d4" font-size="8" font-weight="600" letter-spacing="0.08em">L</text>

          <!-- Upper teeth (labels above so they don't invade the mouth) -->
          <g
            v-for="{ fdi, x, y } in upperPositions"
            :key="'u-' + fdi"
            :transform="`translate(${x - r}, ${y - r})`"
            class="cursor-pointer"
            @click.self="onToothClick(fdi)"
          >
            <circle
              v-if="selectedFdi === fdi"
              :cx="r" :cy="r" :r="outerR + 4"
              fill="none" stroke="#3b7ddd" stroke-width="1.8" opacity="0.55"
            >
              <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
            </circle>
            <line
              v-if="isMissing(fdi)"
              :x1="r - outerR * 0.7" :y1="r - outerR * 0.7"
              :x2="r + outerR * 0.7" :y2="r + outerR * 0.7"
              stroke="#9ca3af" stroke-width="2" stroke-linecap="round"
              pointer-events="none"
            />
            <path
              v-for="(d, surface) in surfacePaths"
              :key="surface"
              :d="d"
              :fill="toothFill(fdi, isSurfaceActive(fdi, surface as ToothSurface), selectedFdi === fdi)"
              :stroke="toothStroke(fdi, isSurfaceActive(fdi, surface as ToothSurface), selectedFdi === fdi)"
              stroke-width="1.2" stroke-linejoin="round"
              style="transition: fill 0.15s, stroke 0.15s"
              @click.stop="onSurfaceClick(fdi, surface as ToothSurface)"
            />
            <circle
              v-if="hasData(fdi) && selectedFdi !== fdi"
              :cx="r" :cy="r" :r="2.5"
              fill="#3b7ddd" opacity="0.85" pointer-events="none"
            />
            <!-- Label ABOVE for upper teeth -->
            <text
              :x="r" :y="-4"
              text-anchor="middle"
              :fill="selectedFdi === fdi ? '#3b7ddd' : hasData(fdi) ? '#5c6478' : '#9aa0b0'"
              font-size="9" font-weight="700"
              font-family="'SF Mono', 'Fira Code', monospace"
              pointer-events="none"
            >
              {{ fdi }}
            </text>
          </g>

          <!-- Lower teeth (labels below so they don't invade the mouth) -->
          <g
            v-for="{ fdi, x, y } in lowerPositions"
            :key="'l-' + fdi"
            :transform="`translate(${x - r}, ${y - r})`"
            class="cursor-pointer"
            @click.self="onToothClick(fdi)"
          >
            <circle
              v-if="selectedFdi === fdi"
              :cx="r" :cy="r" :r="outerR + 4"
              fill="none" stroke="#3b7ddd" stroke-width="1.8" opacity="0.55"
            >
              <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
            </circle>
            <line
              v-if="isMissing(fdi)"
              :x1="r - outerR * 0.7" :y1="r - outerR * 0.7"
              :x2="r + outerR * 0.7" :y2="r + outerR * 0.7"
              stroke="#9ca3af" stroke-width="2" stroke-linecap="round"
              pointer-events="none"
            />
            <path
              v-for="(d, surface) in surfacePaths"
              :key="surface"
              :d="d"
              :fill="toothFill(fdi, isSurfaceActive(fdi, surface as ToothSurface), selectedFdi === fdi)"
              :stroke="toothStroke(fdi, isSurfaceActive(fdi, surface as ToothSurface), selectedFdi === fdi)"
              stroke-width="1.2" stroke-linejoin="round"
              style="transition: fill 0.15s, stroke 0.15s"
              @click.stop="onSurfaceClick(fdi, surface as ToothSurface)"
            />
            <circle
              v-if="hasData(fdi) && selectedFdi !== fdi"
              :cx="r" :cy="r" :r="2.5"
              fill="#3b7ddd" opacity="0.85" pointer-events="none"
            />
            <!-- Label BELOW for lower teeth -->
            <text
              :x="r" :y="toothSize + 11"
              text-anchor="middle"
              :fill="selectedFdi === fdi ? '#3b7ddd' : hasData(fdi) ? '#5c6478' : '#9aa0b0'"
              font-size="9" font-weight="700"
              font-family="'SF Mono', 'Fira Code', monospace"
              pointer-events="none"
            >
              {{ fdi }}
            </text>
          </g>
        </svg>

        <!-- Center floating panel -->
        <div
          v-if="selectedFdi && !readonly"
          class="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-3xl border bg-background/95 px-5 pt-4 pb-3 shadow-xl backdrop-blur-md"
        >
          <!-- Header -->
          <div class="flex w-full items-baseline gap-2">
            <span class="font-mono text-xl font-extrabold text-primary">#{{ selectedFdi }}</span>
            <span class="flex-1 truncate text-[11px] font-medium text-muted-foreground">
              {{ toothLabel(selectedFdi) }}
            </span>
            <button
              type="button"
              :aria-label="`Edit tooth ${selectedFdi} details`"
              class="flex size-7 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              @click="openDetails"
            >
              <PencilLine class="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Close"
              class="flex size-7 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              @click="closePanel"
            >
              <X class="size-3.5" />
            </button>
          </div>

          <!-- Big SVG -->
          <svg :width="PANEL_SIZE" :height="PANEL_SIZE" :viewBox="`0 0 ${PANEL_SIZE} ${PANEL_SIZE}`" class="block">
            <path
              v-for="(d, surface) in PANEL_PATHS"
              :key="surface"
              :d="d"
              :fill="isSurfaceActive(selectedFdi, surface as ToothSurface) ? '#3b7ddd' : '#edf0f4'"
              :stroke="isSurfaceActive(selectedFdi, surface as ToothSurface) ? '#3b7ddd' : '#d0d5e0'"
              stroke-width="2" stroke-linejoin="round"
              class="cursor-pointer"
              style="transition: fill 0.15s, stroke 0.15s"
              @click="emit('surface-toggle', selectedFdi, surface as ToothSurface)"
            />
            <text
              v-for="(pos, surface) in PANEL_LABEL_POS"
              :key="surface"
              :x="pos.x" :y="pos.y + 4"
              text-anchor="middle"
              :fill="isSurfaceActive(selectedFdi, surface as ToothSurface) ? '#fff' : '#9aa0b0'"
              font-size="12" font-weight="700" pointer-events="none"
            >
              {{ SURFACE_CODES[surface] }}
            </text>
            <text
              :x="PC" :y="PC + 5" text-anchor="middle"
              :fill="isSurfaceActive(selectedFdi, 'occlusal') ? '#fff' : '#9aa0b0'"
              font-size="13" font-weight="800" pointer-events="none"
            >
              O
            </text>
            <text :x="PC" y="10" text-anchor="middle" fill="#c4c9d4" font-size="8" font-weight="700" letter-spacing="0.08em" pointer-events="none">B</text>
            <text :x="PC" :y="PANEL_SIZE - 4" text-anchor="middle" fill="#c4c9d4" font-size="8" font-weight="700" letter-spacing="0.08em" pointer-events="none">L</text>
            <text x="8" :y="PC + 3" text-anchor="start" fill="#c4c9d4" font-size="8" font-weight="700" letter-spacing="0.08em" pointer-events="none">M</text>
            <text :x="PANEL_SIZE - 8" :y="PC + 3" text-anchor="end" fill="#c4c9d4" font-size="8" font-weight="700" letter-spacing="0.08em" pointer-events="none">D</text>
          </svg>

          <!-- Surface pills -->
          <div class="flex flex-wrap justify-center gap-1">
            <button
              v-for="sf in SURFACES_ORDER"
              :key="sf"
              type="button"
              class="rounded-md border px-2 py-0.5 text-[9px] font-semibold uppercase transition-colors"
              :class="isSurfaceActive(selectedFdi, sf) ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-muted/40 text-muted-foreground hover:border-primary/30'"
              @click="emit('surface-toggle', selectedFdi, sf)"
            >
              <b>{{ SURFACE_CODES[sf] }}</b>
              <span class="ml-1 opacity-60">{{ sf }}</span>
            </button>
          </div>

          <!-- Code output -->
          <div class="flex min-h-[28px] w-full items-center justify-center gap-2 border-t pt-2">
            <template v-if="surfaceCode(selectedFdi)">
              <span class="font-mono text-lg font-extrabold tracking-widest">{{ surfaceCode(selectedFdi) }}</span>
              <span class="rounded bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">
                {{ selectedFdi }}-{{ surfaceCode(selectedFdi) }}
              </span>
            </template>
            <span v-else class="text-[11px] italic text-muted-foreground">Tap surfaces to mark</span>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="mt-1 flex flex-wrap justify-center gap-2 text-[10px] text-muted-foreground">
        <span class="inline-flex items-center gap-1"><span class="size-3 rounded border border-[#d0d5e0] bg-[#edf0f4]" />Healthy</span>
        <span class="inline-flex items-center gap-1"><span class="size-3 rounded border border-[#fbbf24] bg-[#fef3c7]" />Early</span>
        <span class="inline-flex items-center gap-1"><span class="size-3 rounded border border-[#fb923c] bg-[#fed7aa]" />Moderate</span>
        <span class="inline-flex items-center gap-1"><span class="size-3 rounded border border-[#f87171] bg-[#fecaca]" />Severe</span>
        <span class="inline-flex items-center gap-1"><span class="size-3 rounded border border-[#93c5fd] bg-[#dbeafe]" />Restored</span>
        <span class="inline-flex items-center gap-1"><span class="size-3 rounded border border-[#9ca3af] bg-[#e5e7eb]" />Missing</span>
        <span class="inline-flex items-center gap-1"><span class="size-3 rounded border border-primary bg-primary" />Surface</span>
      </div>
    </div>
  </div>
</template>
