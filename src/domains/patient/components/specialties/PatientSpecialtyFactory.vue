<script setup lang="ts">
import { computed } from 'vue'
import { useSpecialtyConfigStore } from '@/stores/specialtyConfigStore'
import GeneralPatientSections from './general/GeneralPatientSections.vue'
import PediatricsPatientSections from './pediatrics/PediatricsPatientSections.vue'
import FMPatientSections from './family-medicine/FMPatientSections.vue'
import ObGynPatientSections from '@/domains/obgyn/components/ObGynPatientSections.vue'

const props = defineProps<{
  patientSex?: string
}>()

const specialtyStore = useSpecialtyConfigStore()
const specialtyKey = computed(() => specialtyStore.config?.key)
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <!-- Universal sections (problem list + allergies) — all specialties -->
    <GeneralPatientSections />
    <!-- Specialty-specific sections -->
    <FMPatientSections v-if="specialtyKey === 'family_medicine' || specialtyKey === 'internal_medicine'" />
    <PediatricsPatientSections
      v-else-if="specialtyKey === 'pediatrics'"
      :patient-sex="props.patientSex"
    />
    <ObGynPatientSections v-else-if="specialtyKey === 'obgyn'" />
  </div>
</template>
