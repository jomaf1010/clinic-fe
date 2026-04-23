<script setup lang="ts">
import AssessmentFactory from '../specialties/AssessmentFactory.vue'
import type { ConsultationAssessment } from '../../types/consultation.types'

defineProps<{
  assessment: ConsultationAssessment
  disabled: boolean
}>()

const emit = defineEmits<{
  save: [payload: { assessment: ConsultationAssessment }]
}>()
</script>

<template>
  <AssessmentFactory
    :assessment="assessment"
    :disabled="disabled"
    @save="emit('save', $event)"
  />
</template>
