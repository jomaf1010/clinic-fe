<script setup lang="ts">
import { computed } from 'vue'
import { useSpecialtyConfigStore } from '@/stores/specialtyConfigStore'
import BaseAssessmentSection from './BaseAssessmentSection.vue'
import FamilyMedicineAssessmentSection from './family-medicine/FamilyMedicineAssessmentSection.vue'
import OBGYNAssessmentSection from './obgyn/OBGYNAssessmentSection.vue'
import type { ConsultationAssessment } from '../../types/consultation.types'

// inheritAttrs: false so $attrs (event listeners from parent) are forwarded via v-bind
defineOptions({ inheritAttrs: false })

defineProps<{
  assessment: ConsultationAssessment
  disabled: boolean
}>()

const specialtyStore = useSpecialtyConfigStore()

// Select the assessment section component based on the active specialty config key.
// Adding a new specialty = one new file + one case here.
const currentComponent = computed(() => {
  switch (specialtyStore.config?.key) {
    case 'pediatrics': return BaseAssessmentSection
    case 'family_medicine':
    case 'internal_medicine': return FamilyMedicineAssessmentSection
    case 'obgyn': return OBGYNAssessmentSection
    default: return BaseAssessmentSection
  }
})
</script>

<template>
  <!--
    v-bind="{ ...$props, ...$attrs }" passes both declared props and event listeners
    ($attrs contains onSave, etc. since we don't declare emits here)
  -->
  <component
    :is="currentComponent"
    v-bind="{ ...$props, ...$attrs }"
  />
</template>
