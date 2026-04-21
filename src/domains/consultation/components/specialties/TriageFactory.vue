<script setup lang="ts">
import { computed } from 'vue'
import { useSpecialtyConfigStore } from '@/stores/specialtyConfigStore'
import GeneralTriageSection from './general/GeneralTriageSection.vue'
import PediatricsTriageSection from './pediatrics/PediatricsTriageSection.vue'
import FamilyMedicineTriageSection from './family-medicine/FamilyMedicineTriageSection.vue'
import OBGYNTriageSection from './obgyn/OBGYNTriageSection.vue'
import type { ConsultationTriage } from '../../types/consultation.types'
import type { LabOrderResponse } from '../../types/labOrder.types'

// inheritAttrs: false so $attrs (event listeners from parent) are forwarded via v-bind
defineOptions({ inheritAttrs: false })

defineProps<{
  triage: ConsultationTriage
  patientId: string
  encounterId: string
  disabled: boolean
  labOrderUpdate?: LabOrderResponse | null
}>()

const specialtyStore = useSpecialtyConfigStore()

// Select the triage section component based on the active specialty config key.
// Adding a new specialty = one new file + one case here.
const currentComponent = computed(() => {
  switch (specialtyStore.config?.key) {
    case 'pediatrics': return PediatricsTriageSection
    case 'family_medicine':
    case 'internal_medicine': return FamilyMedicineTriageSection
    case 'obgyn': return OBGYNTriageSection
    default: return GeneralTriageSection
  }
})
</script>

<template>
  <!--
    v-bind="{ ...$props, ...$attrs }" passes both declared props and event listeners
    ($attrs contains onSave, onPatient-updated, etc. since we don't declare emits here)
  -->
  <component
    :is="currentComponent"
    v-bind="{ ...$props, ...$attrs }"
  />
</template>
