<script setup lang="ts">
import { computed } from 'vue'
import { FlaskConical, CheckCircle2, Clock, Info, FileDown } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RouteNames } from '@/router/routeNames'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { timeAgo } from '@/lib/utils'
import type { ConsultationResponse, LabOrderSummary } from '@/domains/consultation/types/consultation.types'
import { buildNarrative } from '@/lib/narrative'

const props = defineProps<{
  consultation: ConsultationResponse
  patientId: string
  latest?: boolean
}>()

const emit = defineEmits<{
  'show-lab-order': [summary: LabOrderSummary, event: MouseEvent]
}>()

const router = useRouter()
const authStore = useAuthStore()

function openConsultation() {
  router.push({
    name: RouteNames.CONSULTATION_DETAIL,
    params: { patientId: props.patientId, id: props.consultation.id },
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const canSeeAssessment = computed(() => authStore.hasPermission('consultations.edit-assessment'))
const canSeeTreatment = computed(() => authStore.hasPermission('consultations.edit-treatment-plan'))

const summary = computed(() => {
  const c = props.consultation
  return buildNarrative({
    id: c.id,
    complaint: c.triage?.chief_complaint,
    diagnoses: canSeeAssessment.value
      ? (c.assessment?.diagnoses ?? []).map(d => d.description)
      : [],
    advice: canSeeTreatment.value ? c.treatment_plan?.advice : null,
    prescriptionItems: c.prescription_summary?.items,
  })
})
</script>

<template>
  <div
    class="min-w-0 flex-1 cursor-pointer rounded-lg border p-3 transition-colors"
    :class="latest
      ? 'bg-card border-primary/30 shadow-sm hover:bg-primary/5 hover:border-primary/40'
      : 'bg-card/60 border-border/60 opacity-75 hover:opacity-100 hover:bg-card'"
    @click="openConsultation"
  >
    <div class="flex items-center gap-2">
      <TooltipProvider :delay-duration="200">
        <Tooltip>
          <TooltipTrigger as-child>
            <p class="cursor-help text-xs text-muted-foreground">
              {{ timeAgo(consultation.created_at) }}
            </p>
          </TooltipTrigger>
          <TooltipContent side="top" class="text-xs">
            {{ formatDate(consultation.created_at) }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span v-if="consultation.doctor_name" class="text-xs text-muted-foreground">
        &middot; Dr. {{ consultation.doctor_name }}
      </span>
    </div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <p v-if="summary" class="mt-1 text-sm text-muted-foreground leading-relaxed" v-html="summary" />
    <TooltipProvider v-if="consultation.lab_order_summary" :delay-duration="200">
      <div class="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <FlaskConical class="size-3 shrink-0" />
        <span>Lab Orders:</span>
        <Tooltip v-if="consultation.lab_order_summary.completed">
          <TooltipTrigger as-child>
            <span class="flex cursor-help items-center gap-0.5 text-green-600">
              <CheckCircle2 class="size-3" />
              {{ consultation.lab_order_summary.completed }} completed
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" class="max-w-64 text-xs">
            <ul class="list-disc pl-3.5">
              <li v-for="name in consultation.lab_order_summary.completed_items" :key="name">{{ name }}</li>
            </ul>
          </TooltipContent>
        </Tooltip>
        <Tooltip v-if="consultation.lab_order_summary.pending">
          <TooltipTrigger as-child>
            <span class="flex cursor-help items-center gap-0.5 text-amber-600">
              <Clock class="size-3" />
              {{ consultation.lab_order_summary.pending }} pending
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" class="max-w-64 text-xs">
            <ul class="list-disc pl-3.5">
              <li v-for="name in consultation.lab_order_summary.pending_items" :key="name">{{ name }}</li>
            </ul>
          </TooltipContent>
        </Tooltip>
        <button
          type="button"
          class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          @click.stop="emit('show-lab-order', consultation.lab_order_summary!, $event)"
        >
          <Info class="size-3.5" />
        </button>
      </div>
    </TooltipProvider>
    <div v-if="consultation.documents?.length" class="mt-2 flex flex-wrap gap-1.5">
      <a
        v-for="doc in consultation.documents"
        :key="doc.id"
        :href="doc.download_url!"
        target="_blank"
        class="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-600 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900"
        @click.stop
      >
        <FileDown class="size-3" />
        {{ doc.type === 'prescription' ? 'Prescription PDF' : doc.type === 'medical-certificate' ? 'Med. Certificate PDF' : doc.type + ' PDF' }}
      </a>
    </div>
  </div>
</template>
