<script setup lang="ts">
import { computed } from 'vue'
import type { ConsultationTriage } from '@/domains/consultation/types/consultation.types'
import { buildVitalsNarrative } from '@/lib/narrative'
import { useVitalsConfigStore } from '@/stores/vitalsConfigStore'

const props = defineProps<{
  current: ConsultationTriage
  previous: ConsultationTriage
  consultationId: string
}>()

const vitalsConfig = useVitalsConfigStore()

const narrative = computed(() =>
  buildVitalsNarrative(props.consultationId, props.current, props.previous, vitalsConfig.config),
)
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <p v-if="narrative" class="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/30 px-3 py-2 text-xs text-muted-foreground leading-relaxed" v-html="narrative" />
</template>
