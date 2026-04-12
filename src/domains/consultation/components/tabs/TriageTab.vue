<script setup lang="ts">
import TriageFactory from '../specialties/TriageFactory.vue'
import type { ConsultationTriage } from '../../types/consultation.types'
import type { LabOrderResponse } from '../../types/labOrder.types'

const props = defineProps<{
  triage: ConsultationTriage
  patientId: string
  patientAllergies: string[]
  patientConditions: string[]
  consultationId: string
  disabled: boolean
  labOrderUpdate?: LabOrderResponse | null
}>()

const emit = defineEmits<{
  save: [payload: { triage: ConsultationTriage }]
  'patient-updated': []
  'lab-updated': []
}>()
</script>

<template>
  <TriageFactory
    :triage="triage"
    :patient-id="patientId"
    :patient-allergies="patientAllergies"
    :patient-conditions="patientConditions"
    :consultation-id="consultationId"
    :disabled="disabled"
    :lab-order-update="labOrderUpdate"
    @save="emit('save', $event)"
    @patient-updated="emit('patient-updated')"
    @lab-updated="emit('lab-updated')"
  />
</template>
