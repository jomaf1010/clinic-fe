<script setup lang="ts">
import { computed } from 'vue'
import { FlaskConical, CheckCircle2, Clock, Info, FileDown, PlayCircle, AlertTriangle } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RouteNames } from '@/router/routeNames'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import type { ConsultationResponse, LabOrderSummary } from '@/domains/consultation/types/consultation.types'

const props = defineProps<{
  consultation: ConsultationResponse
  patientId: string
}>()

const emit = defineEmits<{
  'show-lab-order': [summary: LabOrderSummary, event: MouseEvent]
}>()

const router = useRouter()
const authStore = useAuthStore()

const doctorInitials = computed(() => {
  const name = props.consultation.doctor_name ?? ''
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'
})

interface VitalAlert { label: string; value: string; status: string; color: string }

const abnormalVitals = computed(() => {
  const vitals = props.consultation.triage?.vitals
  if (!vitals) return []

  const alerts: VitalAlert[] = []

  // BP
  if (vitals.bp) {
    const parts = vitals.bp.split('/')
    const sys = parseInt(parts[0] ?? '0')
    const dia = parseInt(parts[1] ?? '0')
    if (sys > 0 && dia > 0) {
      if (sys < 90 || dia < 60) alerts.push({ label: 'BP', value: vitals.bp, status: 'Low', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800' })
      else if (sys > 139 || dia > 89) alerts.push({ label: 'BP', value: vitals.bp, status: 'High', color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800' })
      else if (sys > 120 || dia > 80) alerts.push({ label: 'BP', value: vitals.bp, status: 'Elevated', color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800' })
    }
  }

  // HR
  if (vitals.hr != null) {
    if (vitals.hr < 60) alerts.push({ label: 'HR', value: `${vitals.hr} bpm`, status: 'Low', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800' })
    else if (vitals.hr > 100) alerts.push({ label: 'HR', value: `${vitals.hr} bpm`, status: 'High', color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800' })
  }

  // Temp
  if (vitals.temp != null) {
    if (vitals.temp < 36) alerts.push({ label: 'Temp', value: `${vitals.temp}°C`, status: 'Low', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800' })
    else if (vitals.temp > 38.5) alerts.push({ label: 'Temp', value: `${vitals.temp}°C`, status: 'High', color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800' })
    else if (vitals.temp > 37.5) alerts.push({ label: 'Temp', value: `${vitals.temp}°C`, status: 'Elevated', color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800' })
  }

  // SpO2
  if (vitals.spo2 != null) {
    if (vitals.spo2 < 90) alerts.push({ label: 'SpO2', value: `${vitals.spo2}%`, status: 'Critical', color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800' })
    else if (vitals.spo2 < 95) alerts.push({ label: 'SpO2', value: `${vitals.spo2}%`, status: 'Low', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800' })
  }

  // RR
  if (vitals.rr != null) {
    if (vitals.rr < 12) alerts.push({ label: 'RR', value: `${vitals.rr}/min`, status: 'Low', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800' })
    else if (vitals.rr > 20) alerts.push({ label: 'RR', value: `${vitals.rr}/min`, status: 'High', color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800' })
  }

  // Blood sugar
  if (vitals.blood_sugar != null) {
    if (vitals.blood_sugar < 70) alerts.push({ label: 'Sugar', value: `${vitals.blood_sugar} mg/dL`, status: 'Low', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800' })
    else if (vitals.blood_sugar > 125) alerts.push({ label: 'Sugar', value: `${vitals.blood_sugar} mg/dL`, status: 'High', color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800' })
    else if (vitals.blood_sugar > 100) alerts.push({ label: 'Sugar', value: `${vitals.blood_sugar} mg/dL`, status: 'Elevated', color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800' })
  }

  // Pain score
  const pain = props.consultation.triage?.pain_score
  if (pain != null && pain >= 7) {
    alerts.push({ label: 'Pain', value: `${pain}/10`, status: 'High', color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800' })
  }

  return alerts
})

function openDraft() {
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
</script>

<template>
  <div
    class="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3 dark:border-amber-700 dark:bg-amber-950/30"
  >
    <div class="flex flex-col gap-3 sm:flex-row">
      <!-- Left (66% on sm+) -->
      <div class="min-w-0 sm:flex-[2]">
        <div class="flex items-center gap-2">
          <p class="text-xs text-muted-foreground">
            {{ formatDate(consultation.created_at) }}
          </p>
          <span class="rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400">
            Draft
          </span>
        </div>
        <p v-if="consultation.triage?.chief_complaint" class="mt-1 text-sm font-medium">
          {{ consultation.triage.chief_complaint }}
        </p>
        <p v-else class="mt-1 text-sm italic text-muted-foreground">No chief complaint yet</p>

        <!-- Abnormal vitals -->
        <div v-if="abnormalVitals.length" class="mt-2 flex flex-wrap gap-1.5">
          <span
            v-for="vital in abnormalVitals"
            :key="vital.label"
            class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium"
            :class="vital.color"
          >
            <AlertTriangle class="size-3" />
            {{ vital.label }}: {{ vital.value }}
            <span class="opacity-75">{{ vital.status }}</span>
          </span>
        </div>

        <template v-if="authStore.hasPermission('consultations.edit-assessment')">
          <span
            v-for="(diagnosis, dIdx) in (consultation.assessment?.diagnoses ?? [])"
            :key="dIdx"
            class="mt-1 mr-1 inline-block rounded-md bg-muted px-2 py-0.5 text-xs"
          >
            {{ diagnosis.description }}
            <span v-if="diagnosis.code" class="ml-0.5 font-mono text-muted-foreground">{{ diagnosis.code }}</span>
          </span>
        </template>
        <p v-if="authStore.hasPermission('consultations.edit-treatment-plan') && consultation.treatment_plan?.advice" class="mt-1.5 text-sm text-muted-foreground">
          {{ consultation.treatment_plan.advice }}
        </p>

        <!-- Doctor -->
        <div v-if="consultation.doctor_name" class="mt-3 flex items-center gap-2">
          <Avatar class="size-6">
            <AvatarImage v-if="consultation.doctor_avatar_url" :src="consultation.doctor_avatar_url" alt="" />
            <AvatarFallback class="bg-primary/10 text-[10px] font-medium text-primary">
              {{ doctorInitials }}
            </AvatarFallback>
          </Avatar>
          <span class="text-xs text-muted-foreground">Dr. {{ consultation.doctor_name }}</span>
        </div>

        <!-- Continue -->
        <Button variant="secondary" size="sm" class="mt-3 gap-1.5" @click.stop="openDraft">
          <PlayCircle class="size-3.5" />
          Continue
        </Button>
      </div>

      <!-- Right (33%) -->
      <div v-if="consultation.lab_order_summary || consultation.documents?.length" class="flex flex-col gap-2 border-t pt-3 sm:flex-[1] sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
        <TooltipProvider v-if="consultation.lab_order_summary" :delay-duration="200">
          <div class="flex flex-col gap-1 text-xs text-muted-foreground">
            <div class="flex items-center gap-1.5">
              <FlaskConical class="size-3 shrink-0" />
              <span class="font-medium">Lab Orders</span>
              <button
                type="button"
                class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                @click.stop="emit('show-lab-order', consultation.lab_order_summary!, $event)"
              >
                <Info class="size-3" />
              </button>
            </div>
            <Tooltip v-if="consultation.lab_order_summary.completed">
              <TooltipTrigger as-child>
                <span class="flex cursor-help items-center gap-1 text-green-600">
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
                <span class="flex cursor-help items-center gap-1 text-amber-600">
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
          </div>
        </TooltipProvider>
        <div v-if="consultation.documents?.length" class="flex flex-col gap-1">
          <a
            v-for="doc in consultation.documents"
            :key="doc.id"
            :href="doc.download_url!"
            target="_blank"
            class="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-600 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900"
            @click.stop
          >
            <FileDown class="size-3" />
            {{ doc.type === 'prescription' ? 'Prescription' : doc.type === 'medical-certificate' ? 'Med. Certificate' : doc.type }}
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
