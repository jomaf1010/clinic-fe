<script setup lang="ts">
import { computed } from 'vue'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { UPPER_FDI, LOWER_FDI } from '../composables/useToothSvg'
import { useToothNumbering } from '../composables/useToothNumbering'
import type { PerioChart, PerioToothRecord, PerioPoint, StampedOdontogram } from '../types/dental.types'

/**
 * Full 6-point periodontal chart — playground parity. Per tooth:
 *   - 3 facial probing points (M | B | D) + BOP dots
 *   - 3 lingual / palatal probing points (M | L | D) + BOP dots
 *   - mobility grade (0, I, II, III)
 *
 * Upper arch reads top-to-bottom: BOP → Facial PD → Palatal PD → BOP → Mobility.
 * Lower arch is mirrored: Mobility → BOP → Lingual PD → Facial PD → BOP → tooth#.
 *
 * `hoveredFdi` is a two-way controlled prop so the odontogram can sync its
 * highlight with the perio cell (and vice versa).
 */
interface Props {
  modelValue?: PerioChart | null
  /** Odontogram — used only to detect missing teeth so probing inputs for
   *  those columns get disabled (no socket contents to probe). */
  stamped?: StampedOdontogram | null
  activeFdi?: number | null
  hoveredFdi?: number | null
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  stamped: null,
  activeFdi: null,
  hoveredFdi: null,
  disabled: false,
})

function isMissing(fdi: number): boolean {
  if (!props.stamped) return false
  const t = props.stamped[String(fdi)] ?? props.stamped[`t${fdi}`]
  return !!t?.missing
}
function isInputDisabled(fdi: number): boolean {
  return props.disabled || isMissing(fdi)
}

const { format: formatTooth } = useToothNumbering()

const emit = defineEmits<{
  'update:modelValue': [value: PerioChart]
  'update:hoveredFdi': [fdi: number | null]
  /** Sidebar's `mods.mobility` chip + ToothCell's `#mobility` SVG group both
   *  read presence-only mobility from `tooth.mods`. We emit a stamped delta
   *  whenever the perio mobility grade transitions across the 0 boundary so
   *  every UI surface reflects the new state. */
  'mobility-mod-change': [fdi: number, present: boolean]
}>()

// ── Mirror flag so we can draw mesial↔distal in the anatomically-correct order ──
/** Quadrants 2 + 4 have mesial on the right side anatomically; flip their 3 points. */
function isMirrored(fdi: number): boolean {
  const q = Math.floor(fdi / 10)
  return q === 2 || q === 4
}
function pointOrder(fdi: number): [0, 1, 2] | [2, 1, 0] {
  return isMirrored(fdi) ? [2, 1, 0] : [0, 1, 2]
}

// ── State helpers ─────────────────────────────────────────────────────
function defaultPoint(): PerioPoint {
  return { pd: null, bop: false }
}
function defaultTooth(): PerioToothRecord {
  return {
    facial: [defaultPoint(), defaultPoint(), defaultPoint()],
    lingual: [defaultPoint(), defaultPoint(), defaultPoint()],
    mobility: 0,
  }
}
function getTooth(fdi: number): PerioToothRecord {
  return props.modelValue?.[String(fdi)] ?? defaultTooth()
}

function mutate(fdi: number, fn: (t: PerioToothRecord) => void) {
  const current = props.modelValue ?? {}
  const key = String(fdi)
  // Deep-clone the touched tooth so we never mutate a shared reference.
  const existing = current[key]
  const tooth: PerioToothRecord = existing
    ? {
        facial: existing.facial.map((p) => ({ ...p })) as PerioToothRecord['facial'],
        lingual: existing.lingual.map((p) => ({ ...p })) as PerioToothRecord['lingual'],
        mobility: existing.mobility,
      }
    : defaultTooth()
  fn(tooth)
  emit('update:modelValue', { ...current, [key]: tooth })
}

function onPdInput(fdi: number, face: 'facial' | 'lingual', idx: 0 | 1 | 2, raw: string) {
  const n = raw === '' ? null : parseInt(raw, 10)
  const value = n != null && Number.isFinite(n) && n >= 0 && n <= 15 ? n : null
  mutate(fdi, (t) => { t[face][idx].pd = value })
}
function toggleBop(fdi: number, face: 'facial' | 'lingual', idx: 0 | 1 | 2) {
  mutate(fdi, (t) => { t[face][idx].bop = !t[face][idx].bop })
}
function setMobility(fdi: number, g: number) {
  const clamped = Math.max(0, Math.min(3, g)) as 0 | 1 | 2 | 3
  const wasPresent = (getTooth(fdi).mobility ?? 0) > 0
  mutate(fdi, (t) => { t.mobility = clamped })
  const nowPresent = clamped > 0
  if (wasPresent !== nowPresent) emit('mobility-mod-change', fdi, nowPresent)
}
function clearAll() {
  emit('update:modelValue', {})
}

// ── Summary stats (top-right of the card) ─────────────────────────────
const summary = computed(() => {
  const pds: number[] = []
  let bopCount = 0
  let pointCount = 0
  for (const fdi of [...UPPER_FDI, ...LOWER_FDI]) {
    const t = props.modelValue?.[String(fdi)]
    if (!t) continue
    for (const face of [t.facial, t.lingual]) {
      for (const pt of face) {
        pointCount++
        if (pt.pd != null) pds.push(pt.pd)
        if (pt.bop) bopCount++
      }
    }
  }
  const sum = pds.reduce((a, b) => a + b, 0)
  return {
    meanPD: pds.length ? +(sum / pds.length).toFixed(1) : null,
    maxPD: pds.length ? Math.max(...pds) : null,
    bopPct: pointCount > 0 ? +(((bopCount / pointCount) * 100).toFixed(0)) : 0,
    pockets4: pds.filter((d) => d >= 4 && d < 6).length,
    pockets6: pds.filter((d) => d >= 6).length,
    pointsRecorded: pds.length,
  }
})

// ── Visual classes ────────────────────────────────────────────────────
function pdClass(pd: number | null): string {
  if (pd == null) return ''
  if (pd <= 3) return 'pd-healthy'
  if (pd <= 5) return 'pd-warning'
  return 'pd-severe'
}

function onHover(fdi: number | null) {
  emit('update:hoveredFdi', fdi)
}
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-card">
    <div class="mb-3 flex items-start justify-between">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Full Periodontal Chart</p>
        <p class="mt-0.5 text-xs text-muted-foreground">
          6-point pocket depth (MB/B/DB · ML/L/DL). Type 1–12 mm. Click the BOP dot to toggle bleeding.
        </p>
      </div>
      <div class="flex items-center gap-3 text-xs">
        <div class="text-muted-foreground">
          Mean PD: <b class="text-foreground">{{ summary.meanPD ?? '—' }}</b>
          · Max: <b class="text-foreground">{{ summary.maxPD ?? '—' }}</b>
          · BOP: <b class="text-foreground">{{ summary.bopPct }}%</b>
          · ≥4: <b class="text-amber-600">{{ summary.pockets4 }}</b>
          · ≥6: <b class="text-red-600">{{ summary.pockets6 }}</b>
        </div>
        <button
          type="button"
          class="rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
          :disabled="disabled"
          @click="clearAll"
        >
          Clear
        </button>
      </div>
    </div>

    <div class="perio-chart">
      <!-- ───── Upper arch ───── -->
      <div class="perio-arch">
        <!-- Tooth numbers -->
        <div class="perio-label-col">&nbsp;</div>
        <div
          v-for="fdi in UPPER_FDI"
          :key="`pn-u-${fdi}`"
          class="perio-num"
          :class="{ 'perio-hovered': hoveredFdi === fdi, 'perio-active': activeFdi === fdi }"
          :data-fdi="fdi"
          @mouseenter="onHover(fdi)"
          @mouseleave="onHover(null)"
        >{{ formatTooth(fdi) }}</div>

        <!-- Upper Facial BOP -->
        <div class="perio-label-col">BOP</div>
        <div
          v-for="fdi in UPPER_FDI"
          :key="`pbopu-${fdi}`"
          class="perio-tooth-col"
          :class="{ 'perio-hovered': hoveredFdi === fdi, 'perio-active': activeFdi === fdi }"
          :data-fdi="fdi"
          @mouseenter="onHover(fdi)"
          @mouseleave="onHover(null)"
        >
          <button
            v-for="idx in pointOrder(fdi)"
            :key="`bopuf-${fdi}-${idx}`"
            type="button"
            class="bop-dot"
            :class="{ 'bop-on': getTooth(fdi).facial[idx].bop }"
            :disabled="isInputDisabled(fdi)"
            :title="`BOP facial point ${idx + 1}`"
            @click="toggleBop(fdi, 'facial', idx)"
          />
        </div>

        <!-- Upper Facial PD -->
        <div class="perio-label-col">Facial</div>
        <div
          v-for="fdi in UPPER_FDI"
          :key="`pduf-${fdi}`"
          class="perio-tooth-col"
          :class="{ 'perio-hovered': hoveredFdi === fdi, 'perio-active': activeFdi === fdi }"
          :data-fdi="fdi"
          @mouseenter="onHover(fdi)"
          @mouseleave="onHover(null)"
        >
          <input
            v-for="idx in pointOrder(fdi)"
            :key="`uf-${fdi}-${idx}`"
            type="number"
            min="0"
            max="15"
            class="pd-input"
            :class="pdClass(getTooth(fdi).facial[idx].pd)"
            :value="getTooth(fdi).facial[idx].pd ?? ''"
            :disabled="isInputDisabled(fdi)"
            @input="(ev) => onPdInput(fdi, 'facial', idx as 0 | 1 | 2, (ev.target as HTMLInputElement).value)"
          >
        </div>

        <!-- Upper Palatal PD -->
        <div class="perio-label-col">Palatal</div>
        <div
          v-for="fdi in UPPER_FDI"
          :key="`pdul-${fdi}`"
          class="perio-tooth-col"
          :class="{ 'perio-hovered': hoveredFdi === fdi, 'perio-active': activeFdi === fdi }"
          :data-fdi="fdi"
          @mouseenter="onHover(fdi)"
          @mouseleave="onHover(null)"
        >
          <input
            v-for="idx in pointOrder(fdi)"
            :key="`ul-${fdi}-${idx}`"
            type="number"
            min="0"
            max="15"
            class="pd-input"
            :class="pdClass(getTooth(fdi).lingual[idx].pd)"
            :value="getTooth(fdi).lingual[idx].pd ?? ''"
            :disabled="isInputDisabled(fdi)"
            @input="(ev) => onPdInput(fdi, 'lingual', idx as 0 | 1 | 2, (ev.target as HTMLInputElement).value)"
          >
        </div>

        <!-- Upper Palatal BOP -->
        <div class="perio-label-col">BOP</div>
        <div
          v-for="fdi in UPPER_FDI"
          :key="`pbopul-${fdi}`"
          class="perio-tooth-col"
          :class="{ 'perio-hovered': hoveredFdi === fdi, 'perio-active': activeFdi === fdi }"
          :data-fdi="fdi"
          @mouseenter="onHover(fdi)"
          @mouseleave="onHover(null)"
        >
          <button
            v-for="idx in pointOrder(fdi)"
            :key="`bopul-${fdi}-${idx}`"
            type="button"
            class="bop-dot"
            :class="{ 'bop-on': getTooth(fdi).lingual[idx].bop }"
            :disabled="isInputDisabled(fdi)"
            @click="toggleBop(fdi, 'lingual', idx)"
          />
        </div>

        <!-- Upper Mobility -->
        <div class="perio-label-col">Mobility</div>
        <div
          v-for="fdi in UPPER_FDI"
          :key="`mobu-${fdi}`"
          class="perio-mobility"
          :class="{ 'perio-hovered': hoveredFdi === fdi, 'perio-active': activeFdi === fdi }"
          :data-fdi="fdi"
          @mouseenter="onHover(fdi)"
          @mouseleave="onHover(null)"
        >
          <NativeSelect
            :model-value="getTooth(fdi).mobility"
            class="h-7 rounded-lg px-1 pr-6 text-center text-[11px] font-bold"
            :disabled="isInputDisabled(fdi)"
            @update:model-value="(value) => setMobility(fdi, parseInt(String(value)))"
          >
            <NativeSelectOption :value="0">—</NativeSelectOption>
            <NativeSelectOption :value="1">I</NativeSelectOption>
            <NativeSelectOption :value="2">II</NativeSelectOption>
            <NativeSelectOption :value="3">III</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>

      <div class="perio-divider" />

      <!-- ───── Lower arch (mirrored order) ───── -->
      <div class="perio-arch">
        <div class="perio-label-col">Mobility</div>
        <div
          v-for="fdi in LOWER_FDI"
          :key="`mobl-${fdi}`"
          class="perio-mobility"
          :class="{ 'perio-hovered': hoveredFdi === fdi, 'perio-active': activeFdi === fdi }"
          :data-fdi="fdi"
          @mouseenter="onHover(fdi)"
          @mouseleave="onHover(null)"
        >
          <NativeSelect
            :model-value="getTooth(fdi).mobility"
            class="h-7 rounded-lg px-1 pr-6 text-center text-[11px] font-bold"
            :disabled="isInputDisabled(fdi)"
            @update:model-value="(value) => setMobility(fdi, parseInt(String(value)))"
          >
            <NativeSelectOption :value="0">—</NativeSelectOption>
            <NativeSelectOption :value="1">I</NativeSelectOption>
            <NativeSelectOption :value="2">II</NativeSelectOption>
            <NativeSelectOption :value="3">III</NativeSelectOption>
          </NativeSelect>
        </div>

        <div class="perio-label-col">BOP</div>
        <div
          v-for="fdi in LOWER_FDI"
          :key="`pbopll-${fdi}`"
          class="perio-tooth-col"
          :class="{ 'perio-hovered': hoveredFdi === fdi, 'perio-active': activeFdi === fdi }"
          :data-fdi="fdi"
          @mouseenter="onHover(fdi)"
          @mouseleave="onHover(null)"
        >
          <button
            v-for="idx in pointOrder(fdi)"
            :key="`bopll-${fdi}-${idx}`"
            type="button"
            class="bop-dot"
            :class="{ 'bop-on': getTooth(fdi).lingual[idx].bop }"
            :disabled="isInputDisabled(fdi)"
            @click="toggleBop(fdi, 'lingual', idx)"
          />
        </div>

        <div class="perio-label-col">Lingual</div>
        <div
          v-for="fdi in LOWER_FDI"
          :key="`pdll-${fdi}`"
          class="perio-tooth-col"
          :class="{ 'perio-hovered': hoveredFdi === fdi, 'perio-active': activeFdi === fdi }"
          :data-fdi="fdi"
          @mouseenter="onHover(fdi)"
          @mouseleave="onHover(null)"
        >
          <input
            v-for="idx in pointOrder(fdi)"
            :key="`ll-${fdi}-${idx}`"
            type="number"
            min="0"
            max="15"
            class="pd-input"
            :class="pdClass(getTooth(fdi).lingual[idx].pd)"
            :value="getTooth(fdi).lingual[idx].pd ?? ''"
            :disabled="isInputDisabled(fdi)"
            @input="(ev) => onPdInput(fdi, 'lingual', idx as 0 | 1 | 2, (ev.target as HTMLInputElement).value)"
          >
        </div>

        <div class="perio-label-col">Facial</div>
        <div
          v-for="fdi in LOWER_FDI"
          :key="`pdlf-${fdi}`"
          class="perio-tooth-col"
          :class="{ 'perio-hovered': hoveredFdi === fdi, 'perio-active': activeFdi === fdi }"
          :data-fdi="fdi"
          @mouseenter="onHover(fdi)"
          @mouseleave="onHover(null)"
        >
          <input
            v-for="idx in pointOrder(fdi)"
            :key="`lf-${fdi}-${idx}`"
            type="number"
            min="0"
            max="15"
            class="pd-input"
            :class="pdClass(getTooth(fdi).facial[idx].pd)"
            :value="getTooth(fdi).facial[idx].pd ?? ''"
            :disabled="isInputDisabled(fdi)"
            @input="(ev) => onPdInput(fdi, 'facial', idx as 0 | 1 | 2, (ev.target as HTMLInputElement).value)"
          >
        </div>

        <div class="perio-label-col">BOP</div>
        <div
          v-for="fdi in LOWER_FDI"
          :key="`pbopl-${fdi}`"
          class="perio-tooth-col"
          :class="{ 'perio-hovered': hoveredFdi === fdi, 'perio-active': activeFdi === fdi }"
          :data-fdi="fdi"
          @mouseenter="onHover(fdi)"
          @mouseleave="onHover(null)"
        >
          <button
            v-for="idx in pointOrder(fdi)"
            :key="`bopl-${fdi}-${idx}`"
            type="button"
            class="bop-dot"
            :class="{ 'bop-on': getTooth(fdi).facial[idx].bop }"
            :disabled="isInputDisabled(fdi)"
            @click="toggleBop(fdi, 'facial', idx)"
          />
        </div>

        <div class="perio-label-col">&nbsp;</div>
        <div
          v-for="fdi in LOWER_FDI"
          :key="`pn-l-${fdi}`"
          class="perio-num"
          :class="{ 'perio-hovered': hoveredFdi === fdi, 'perio-active': activeFdi === fdi }"
          :data-fdi="fdi"
          @mouseenter="onHover(fdi)"
          @mouseleave="onHover(null)"
        >{{ formatTooth(fdi) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.perio-chart {
  --cols: 16;
  font-family: ui-monospace, 'SF Mono', monospace;
  font-size: 11px;
}
.perio-arch {
  display: grid;
  grid-template-columns: 70px repeat(16, minmax(0, 1fr));
  gap: 2px 2px;
  align-items: center;
}
.perio-label-col {
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: right;
  padding-right: 6px;
}
.perio-num {
  text-align: center;
  font-weight: 700;
  color: #0f172a;
  font-size: 11px;
  padding: 3px 0;
  background: #f8fafc;
  border-radius: 4px;
}
.perio-tooth-col {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
}
.perio-mobility {
  display: flex;
  justify-content: center;
}
.pd-input {
  width: 100%;
  height: 22px;
  padding: 0;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
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
  height: 12px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  aspect-ratio: 1/1;
  max-width: 12px;
  justify-self: center;
}
.bop-dot:hover { background: rgba(148, 163, 184, 0.2); }
.bop-dot:disabled { cursor: not-allowed; opacity: 0.6; }
.bop-dot.bop-on {
  background: rgb(239, 68, 68);
  border-color: #b91c1c;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
}
.perio-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
  margin: 10px 0;
}
.perio-num, .perio-tooth-col, .perio-mobility {
  transition: background 120ms, box-shadow 120ms;
  border-radius: 4px;
}
.perio-num.perio-hovered,
.perio-num.perio-active {
  background: rgb(59, 123, 255);
  color: white;
}
.perio-tooth-col.perio-hovered,
.perio-mobility.perio-hovered {
  background: rgba(59, 123, 255, 0.12);
  box-shadow: inset 0 0 0 1px rgba(59, 123, 255, 0.3);
}
.perio-tooth-col.perio-active,
.perio-mobility.perio-active {
  background: rgba(59, 123, 255, 0.22);
  box-shadow: inset 0 0 0 1.5px rgba(59, 123, 255, 0.65);
}
</style>
