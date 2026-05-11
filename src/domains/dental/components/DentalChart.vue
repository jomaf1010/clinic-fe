<script setup lang="ts">
import { computed, ref } from 'vue'
import ToothCell from './ToothCell.vue'
import ToothContextMenu from './ToothContextMenu.vue'
import { LOWER_FDI, UPPER_FDI, hasOcclusalView } from '../composables/useToothSvg'
import type { StampedOdontogram, StampedToothState, PerioChart, PerioToothRecord } from '../types/dental.types'
import type { DisplayOdontogram } from '../composables/useDisplayOdontogram'

/**
 * FDI odontogram — playground-parity 4-row layout:
 *   row 1: upper buccal (label on top, tooth hugging midline)
 *   row 2: upper occlusal (only where template exists)
 *   row 3: lower occlusal
 *   row 4: lower buccal (tooth hugging midline, label below)
 *
 * Consumes `DisplayOdontogram` (the projection from `useDisplayOdontogram`)
 * for layered tri-state rendering, and `StampedOdontogram` for raw
 * per-field details.
 */

interface Props {
  display?: DisplayOdontogram | null
  stamped?: StampedOdontogram | null
  /** Full perio chart (FDI-keyed). Drives the red perio-indicator dot. */
  perioChart?: PerioChart | null
  activeFdi?: number | null
  selected?: Set<number>
  /** Hide the mid occlusal rows (compact mode). */
  hideOcclusal?: boolean
  /** Pass-through to disable the context menu (e.g. finalized visit). */
  contextMenuDisabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  display: null,
  stamped: null,
  perioChart: null,
  activeFdi: null,
  selected: () => new Set(),
  hideOcclusal: false,
  contextMenuDisabled: false,
})

function recordHasPerio(rec: PerioToothRecord | undefined | null): boolean {
  if (!rec) return false
  if ((rec.mobility ?? 0) > 0) return true
  for (const face of [rec.facial, rec.lingual]) {
    for (const pt of face ?? []) {
      if (pt?.pd != null) return true
      if (pt?.bop) return true
    }
  }
  return false
}

function hasPerioFor(fdi: number): boolean {
  return recordHasPerio(props.perioChart?.[String(fdi)])
}

function perioRecordFor(fdi: number): PerioToothRecord | null {
  return props.perioChart?.[String(fdi)] ?? null
}

const emit = defineEmits<{
  'select-tooth': [fdi: number, anchor: HTMLElement | null]
  'hover-tooth': [fdi: number | null]
  'apply-tooth': [fdi: number, delta: Partial<StampedToothState>]
  'reset-tooth': [fdi: number]
  'open-detail': [fdi: number]
  'clear-perio': [fdi: number]
}>()

function onCellClick(fdi: number, ev: MouseEvent) {
  const target = (ev.currentTarget as HTMLElement) ?? null
  emit('select-tooth', fdi, target)
}

const hoveredFdi = ref<number | null>(null)

const upperRow = computed(() => UPPER_FDI)
const lowerRow = computed(() => LOWER_FDI)

function displayFor(fdi: number) {
  const key = String(fdi)
  return props.display?.[key] ?? null
}

function stampedFor(fdi: number) {
  if (!props.stamped) return null
  return props.stamped[String(fdi)] ?? props.stamped[`t${fdi}`] ?? null
}

function onHover(fdi: number, hovering: boolean) {
  if (hovering) {
    hoveredFdi.value = fdi
    emit('hover-tooth', fdi)
  } else if (hoveredFdi.value === fdi) {
    hoveredFdi.value = null
    emit('hover-tooth', null)
  }
}
</script>

<template>
  <div class="dental-chart">
    <!-- Row 1: upper buccal -->
    <div class="row">
      <ToothContextMenu
        v-for="fdi in upperRow"
        :key="`ub-${fdi}`"
        :fdi="fdi"
        :state="stampedFor(fdi)"
        :disabled="contextMenuDisabled"
        @open="emit('select-tooth', fdi, null)"
        @apply="(d) => emit('apply-tooth', fdi, d)"
        @reset-tooth="emit('reset-tooth', fdi)"
        @open-detail="emit('open-detail', fdi)"
        @clear-perio="emit('clear-perio', fdi)"
      >
        <ToothCell
          :fdi="fdi"
          :display-state="displayFor(fdi)"
          :stamped-state="stampedFor(fdi)"
          :is-active="activeFdi === fdi"
          :is-selected="selected.has(fdi)"
          :is-hovered="hoveredFdi === fdi"
          :has-perio="hasPerioFor(fdi)"
          :perio-record="perioRecordFor(fdi)"
          view="buccal"
          label-position="top"
          variant="buccal"
          @click="(ev) => onCellClick(fdi, ev)"
          @hover="onHover(fdi, $event)"
        />
      </ToothContextMenu>
    </div>

    <!-- Row 2: upper occlusal -->
    <div v-if="!hideOcclusal" class="row occl-row">
      <template v-for="fdi in upperRow" :key="`uo-${fdi}`">
        <ToothContextMenu
          v-if="hasOcclusalView(fdi)"
          :fdi="fdi"
          :state="stampedFor(fdi)"
          :disabled="contextMenuDisabled"
          @open="emit('select-tooth', fdi, null)"
          @apply="(d) => emit('apply-tooth', fdi, d)"
          @reset-tooth="emit('reset-tooth', fdi)"
          @open-detail="emit('open-detail', fdi)"
          @clear-perio="emit('clear-perio', fdi)"
        >
          <ToothCell
            :fdi="fdi"
            :display-state="displayFor(fdi)"
            :stamped-state="stampedFor(fdi)"
            :is-active="activeFdi === fdi"
            :is-selected="selected.has(fdi)"
            :is-hovered="hoveredFdi === fdi"
            :has-perio="hasPerioFor(fdi)"
          :perio-record="perioRecordFor(fdi)"
            view="occlusal"
            label-position="none"
            variant="occlusal"
            @click="(ev) => onCellClick(fdi, ev)"
            @hover="onHover(fdi, $event)"
          />
        </ToothContextMenu>
        <div v-else class="cell-placeholder" />
      </template>
    </div>

    <!-- Row 3: lower occlusal -->
    <div v-if="!hideOcclusal" class="row occl-row">
      <template v-for="fdi in lowerRow" :key="`lo-${fdi}`">
        <ToothContextMenu
          v-if="hasOcclusalView(fdi)"
          :fdi="fdi"
          :state="stampedFor(fdi)"
          :disabled="contextMenuDisabled"
          @open="emit('select-tooth', fdi, null)"
          @apply="(d) => emit('apply-tooth', fdi, d)"
          @reset-tooth="emit('reset-tooth', fdi)"
          @open-detail="emit('open-detail', fdi)"
          @clear-perio="emit('clear-perio', fdi)"
        >
          <ToothCell
            :fdi="fdi"
            :display-state="displayFor(fdi)"
            :stamped-state="stampedFor(fdi)"
            :is-active="activeFdi === fdi"
            :is-selected="selected.has(fdi)"
            :is-hovered="hoveredFdi === fdi"
            :has-perio="hasPerioFor(fdi)"
          :perio-record="perioRecordFor(fdi)"
            view="occlusal"
            label-position="none"
            variant="occlusal"
            @click="(ev) => onCellClick(fdi, ev)"
            @hover="onHover(fdi, $event)"
          />
        </ToothContextMenu>
        <div v-else class="cell-placeholder" />
      </template>
    </div>

    <!-- Row 4: lower buccal -->
    <div class="row">
      <ToothContextMenu
        v-for="fdi in lowerRow"
        :key="`lb-${fdi}`"
        :fdi="fdi"
        :state="stampedFor(fdi)"
        :disabled="contextMenuDisabled"
        @open="emit('select-tooth', fdi, null)"
        @apply="(d) => emit('apply-tooth', fdi, d)"
        @reset-tooth="emit('reset-tooth', fdi)"
        @open-detail="emit('open-detail', fdi)"
        @clear-perio="emit('clear-perio', fdi)"
      >
        <ToothCell
          :fdi="fdi"
          :display-state="displayFor(fdi)"
          :stamped-state="stampedFor(fdi)"
          :is-active="activeFdi === fdi"
          :is-selected="selected.has(fdi)"
          :is-hovered="hoveredFdi === fdi"
          :has-perio="hasPerioFor(fdi)"
          :perio-record="perioRecordFor(fdi)"
          view="buccal"
          label-position="bottom"
          variant="buccal"
          @click="(ev) => onCellClick(fdi, ev)"
          @hover="onHover(fdi, $event)"
        />
      </ToothContextMenu>
    </div>
  </div>
</template>

<style scoped>
.dental-chart {
  --cell-w: 56px;
  --cell-h: 96px;
  --cell-h-occl: 64px;
  user-select: none;
}
.row {
  display: grid;
  grid-template-columns: repeat(16, minmax(0, 1fr));
  gap: 2px;
}
.row + .row { margin-top: 2px; }
.cell-placeholder {
  min-height: var(--cell-h-occl);
}
</style>
