<script setup lang="ts">
import { computed } from 'vue'
import { PSR_SEXTANTS, sextantForFdi, type PsrSextantKey } from '../composables/useFdiTeeth'
import type { PerioPSR } from '../types/dental.types'

/**
 * Periodontal Screening & Recording (PSR) — 6 sextants × 0-4 codes.
 * Quick-tap grid for mobile-first input.
 *
 * Codes (BPE/PSR):
 *   0 — healthy
 *   1 — bleeding on probing, no calculus / pockets ≤ 3mm
 *   2 — calculus / sub-gingival visible, no pockets ≤ 3mm
 *   3 — pockets 4-5 mm
 *   4 — pockets ≥ 6 mm or furcation
 */
const props = withDefaults(defineProps<{
  modelValue: PerioPSR | null
  /** Active tooth (chart selection). Highlights its containing sextant. */
  activeFdi?: number | null
  /** Hovered tooth from the chart — also highlights its sextant. */
  hoveredFdi?: number | null
}>(), {
  activeFdi: null,
  hoveredFdi: null,
})
const emit = defineEmits<{ 'update:modelValue': [value: PerioPSR] }>()

const activeSextant = computed(() => sextantForFdi(props.activeFdi))
const hoveredSextant = computed(() => sextantForFdi(props.hoveredFdi))

const value = computed<PerioPSR>(() => props.modelValue ?? {})

function setCode(key: PsrSextantKey, code: number | null): void {
  emit('update:modelValue', { ...value.value, [key]: code })
}

function colorClass(code: number | null | undefined): string {
  if (code === null || code === undefined) return 'bg-muted text-muted-foreground border-border'
  if (code === 0) return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30'
  if (code === 1) return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30'
  if (code === 2) return 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-500/10 dark:text-orange-200 dark:border-orange-500/30'
  if (code === 3) return 'bg-red-100 text-red-900 border-red-300 dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/30'
  if (code === 4) return 'bg-red-200 text-red-900 border-red-500 font-bold dark:bg-red-500/20 dark:text-red-100 dark:border-red-500/50'
  return 'bg-muted'
}
</script>

<template>
  <div class="rounded-2xl border bg-card p-3">
    <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Periodontal Screening (PSR)</p>

    <div class="grid grid-cols-3 gap-2">
      <div
        v-for="s in PSR_SEXTANTS"
        :key="s.key"
        class="flex flex-col gap-1 rounded-md p-1 transition-shadow"
        :class="{
          'sextant-active': activeSextant === s.key,
          'sextant-hovered': activeSextant !== s.key && hoveredSextant === s.key,
        }"
      >
        <p class="text-xs font-medium">{{ s.label }}</p>
        <div class="flex gap-1">
          <button
            v-for="code in [0, 1, 2, 3, 4]"
            :key="code"
            type="button"
            class="flex h-8 flex-1 items-center justify-center rounded-md border text-xs transition-shadow hover:shadow"
            :class="[colorClass(value[s.key] === code ? code : null), value[s.key] === code ? 'ring-2 ring-primary ring-offset-1' : '']"
            :aria-label="`${s.label} code ${code}`"
            :aria-pressed="value[s.key] === code"
            @click="setCode(s.key, value[s.key] === code ? null : code)"
          >
            {{ code }}
          </button>
        </div>
      </div>
    </div>

    <p class="mt-2 text-[10px] text-muted-foreground">
      0 healthy · 1 bleeding · 2 calculus · 3 pocket 4-5mm · 4 pocket ≥6mm or furcation
    </p>
  </div>
</template>

<style scoped>
.sextant-active {
  background: rgba(59, 123, 255, 0.14);
  box-shadow: inset 0 0 0 1.5px rgba(59, 123, 255, 0.55);
}
.sextant-hovered {
  background: rgba(59, 123, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(59, 123, 255, 0.3);
}
</style>
