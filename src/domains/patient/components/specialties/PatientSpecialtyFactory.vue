<script setup lang="ts">
import { computed } from 'vue'
import { useSpecialtyConfigStore } from '@/stores/specialtyConfigStore'
import GeneralPatientSections from './general/GeneralPatientSections.vue'
import PediatricsPatientSections from './pediatrics/PediatricsPatientSections.vue'
import FMPatientSections from './family-medicine/FMPatientSections.vue'

const specialtyStore = useSpecialtyConfigStore()

const currentComponent = computed(() => {
  switch (specialtyStore.config?.key) {
    case 'pediatrics': return PediatricsPatientSections
    case 'family_medicine': return FMPatientSections
    default: return GeneralPatientSections
  }
})
</script>

<template>
  <component :is="currentComponent" />
</template>
