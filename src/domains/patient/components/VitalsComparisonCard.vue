<script setup lang="ts">
import { computed } from 'vue'
import type { ConsultationTriage } from '@/domains/consultation/types/consultation.types'
import { buildVitalsNarrative } from '@/lib/narrative'
import { useVitalsConfigStore } from '@/stores/vitalsConfigStore'

const props = defineProps<{
  current: ConsultationTriage
  previous: ConsultationTriage
  encounterId: string
}>()

const vitalsConfig = useVitalsConfigStore()

const narrative = computed(() =>
  buildVitalsNarrative(props.encounterId, props.current, props.previous, vitalsConfig.config),
)
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <p v-if="narrative" class="patient-vitals-comparison surface-muted rounded-2xl px-4 py-3 text-xs text-muted-foreground leading-relaxed" v-html="narrative" />
</template>

<style scoped>
.patient-vitals-comparison {
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.28),
    0 12px 28px rgb(15 23 42 / 0.06);
}

:global(.dark .patient-vitals-comparison) {
  background:
    linear-gradient(145deg, rgb(15 23 42 / 0.72), rgb(2 6 23 / 0.48)),
    rgb(15 23 42 / 0.46) !important;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.1),
    0 14px 30px rgb(0 0 0 / 0.22);
}
</style>
