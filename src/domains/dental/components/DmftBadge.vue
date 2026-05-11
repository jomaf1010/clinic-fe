<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  score: number | null
  decayed?: number | null
  missing?: number | null
  filled?: number | null
  primaryScore?: number | null
}>()

const severity = computed<'good' | 'low' | 'moderate' | 'high' | 'severe' | 'unknown'>(() => {
  if (props.score === null || props.score === undefined) return 'unknown'
  if (props.score === 0) return 'good'
  if (props.score <= 8) return 'low'
  if (props.score <= 16) return 'moderate'
  if (props.score <= 20) return 'high'
  return 'severe'
})

const colorClass = computed(() => {
  switch (severity.value) {
    case 'good': return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30'
    case 'low': return 'bg-lime-100 text-lime-900 border-lime-300 dark:bg-lime-500/10 dark:text-lime-200 dark:border-lime-500/30'
    case 'moderate': return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30'
    case 'high': return 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-500/10 dark:text-orange-200 dark:border-orange-500/30'
    case 'severe': return 'bg-red-100 text-red-900 border-red-300 dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/30'
    default: return 'bg-muted text-muted-foreground border-border'
  }
})

const label = computed(() => {
  switch (severity.value) {
    case 'good': return 'No caries'
    case 'low': return 'Low'
    case 'moderate': return 'Moderate'
    case 'high': return 'High'
    case 'severe': return 'Severe'
    default: return '—'
  }
})
</script>

<template>
  <div class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5" :class="colorClass">
    <span class="text-xs font-semibold uppercase tracking-wide opacity-70">DMFT</span>
    <span class="text-base font-bold tabular-nums">{{ props.score ?? '—' }}</span>
    <span class="text-[11px] opacity-80">{{ label }}</span>
    <span v-if="props.decayed !== null && props.decayed !== undefined" class="text-[10px] opacity-70">
      ({{ props.decayed }}D · {{ props.missing ?? 0 }}M · {{ props.filled ?? 0 }}F)
    </span>
    <span v-if="props.primaryScore" class="text-[10px] opacity-70">+ dmft {{ props.primaryScore }}</span>
  </div>
</template>
