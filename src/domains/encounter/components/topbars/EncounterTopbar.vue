<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import DefaultEncounterTopbar from './DefaultEncounterTopbar.vue'
import FamilyMedicineEncounterTopbar from './FamilyMedicineEncounterTopbar.vue'
import InternalMedicineEncounterTopbar from './InternalMedicineEncounterTopbar.vue'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  specialty: string | null | undefined
  patientName: string | null
  consultationType?: string | null
  isDraft: boolean
  isFinalized: boolean
  isSaving: boolean
  saveError: string | null
  canFinalize: boolean
  summaryReady: boolean
  isGeneratingSummary: boolean
}>()
const attrs = useAttrs()

const topbarComponent = computed(() => {
  switch (props.specialty) {
    case 'family_medicine':
      return FamilyMedicineEncounterTopbar
    case 'internal_medicine':
      return InternalMedicineEncounterTopbar
    default:
      return DefaultEncounterTopbar
  }
})

const topbarProps = computed(() => ({
  patientName: props.patientName,
  consultationType: props.consultationType,
  isDraft: props.isDraft,
  isFinalized: props.isFinalized,
  isSaving: props.isSaving,
  saveError: props.saveError,
  canFinalize: props.canFinalize,
  summaryReady: props.summaryReady,
  isGeneratingSummary: props.isGeneratingSummary,
}))

const forwardedTopbarProps = computed(() => ({
  ...topbarProps.value,
  ...attrs,
}))
</script>

<template>
  <component :is="topbarComponent" v-bind="forwardedTopbarProps" />
</template>
