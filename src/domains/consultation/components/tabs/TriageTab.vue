<script setup lang="ts">
import TriageFactory from '../specialties/TriageFactory.vue'
import type { ConsultationTriage } from '../../types/consultation.types'
import type { LabOrderResponse } from '../../types/labOrder.types'

const props = defineProps<{
  triage: ConsultationTriage
  patientId: string
  encounterId: string
  disabled: boolean
  labOrderUpdate?: LabOrderResponse | null
}>()

const emit = defineEmits<{
  save: [payload: { triage: ConsultationTriage }]
  'lab-updated': []
}>()
</script>

<template>
  <TriageFactory
    :triage="triage"
    :patient-id="patientId"
    :encounter-id="encounterId"
    :disabled="disabled"
    :lab-order-update="labOrderUpdate"
    @save="emit('save', $event)"
    @lab-updated="emit('lab-updated')"
  />
</template>
