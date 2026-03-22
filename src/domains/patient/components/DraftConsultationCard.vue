<script setup lang="ts">
import { computed } from 'vue'
import { FlaskConical, Info, FileDown, PlayCircle, AlertTriangle } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RouteNames } from '@/router/routeNames'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { timeAgo } from '@/lib/utils'
import { classifyBpString } from '@/lib/vitals'
import type { ConsultationResponse, LabOrderSummary } from '@/domains/consultation/types/consultation.types'
import { buildNarrative } from '@/lib/narrative'

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

  // BP — AHA/ACC classification
  const bpResult = classifyBpString(vitals.bp)
  if (bpResult && bpResult.severity >= 1) {
    const isHigh = bpResult.severity >= 2 // stage1+
    alerts.push({
      label: 'BP',
      value: `${vitals.bp} · ${bpResult.label}`,
      status: bpResult.severity >= 3 ? 'High' : bpResult.severity >= 2 ? 'Elevated' : 'Elevated',
      color: isHigh
        ? 'text-white bg-red-500 border-red-500 dark:bg-red-600 dark:border-red-600'
        : 'text-white bg-amber-500 border-amber-500 dark:bg-amber-600 dark:border-amber-600',
    })
  }

  // HR
  if (vitals.hr != null) {
    if (vitals.hr < 60) alerts.push({ label: 'HR', value: `${vitals.hr} bpm`, status: 'Low', color: 'text-white bg-amber-500 border-amber-500 dark:bg-amber-600 dark:border-amber-600' })
    else if (vitals.hr > 100) alerts.push({ label: 'HR', value: `${vitals.hr} bpm`, status: 'High', color: 'text-white bg-red-500 border-red-500 dark:bg-red-600 dark:border-red-600' })
  }

  // Temp
  if (vitals.temp != null) {
    if (vitals.temp < 36) alerts.push({ label: 'Temp', value: `${vitals.temp}°C`, status: 'Low', color: 'text-white bg-amber-500 border-amber-500 dark:bg-amber-600 dark:border-amber-600' })
    else if (vitals.temp > 38.5) alerts.push({ label: 'Temp', value: `${vitals.temp}°C`, status: 'High', color: 'text-white bg-red-500 border-red-500 dark:bg-red-600 dark:border-red-600' })
    else if (vitals.temp > 37.5) alerts.push({ label: 'Temp', value: `${vitals.temp}°C`, status: 'Elevated', color: 'text-white bg-red-500 border-red-500 dark:bg-red-600 dark:border-red-600' })
  }

  // SpO2
  if (vitals.spo2 != null) {
    if (vitals.spo2 < 90) alerts.push({ label: 'SpO2', value: `${vitals.spo2}%`, status: 'Critical', color: 'text-white bg-red-500 border-red-500 dark:bg-red-600 dark:border-red-600' })
    else if (vitals.spo2 < 95) alerts.push({ label: 'SpO2', value: `${vitals.spo2}%`, status: 'Low', color: 'text-white bg-amber-500 border-amber-500 dark:bg-amber-600 dark:border-amber-600' })
  }

  // RR
  if (vitals.rr != null) {
    if (vitals.rr < 12) alerts.push({ label: 'RR', value: `${vitals.rr}/min`, status: 'Low', color: 'text-white bg-amber-500 border-amber-500 dark:bg-amber-600 dark:border-amber-600' })
    else if (vitals.rr > 20) alerts.push({ label: 'RR', value: `${vitals.rr}/min`, status: 'High', color: 'text-white bg-red-500 border-red-500 dark:bg-red-600 dark:border-red-600' })
  }

  // Blood sugar
  if (vitals.blood_sugar != null) {
    if (vitals.blood_sugar < 70) alerts.push({ label: 'Sugar', value: `${vitals.blood_sugar} mg/dL`, status: 'Low', color: 'text-white bg-amber-500 border-amber-500 dark:bg-amber-600 dark:border-amber-600' })
    else if (vitals.blood_sugar > 125) alerts.push({ label: 'Sugar', value: `${vitals.blood_sugar} mg/dL`, status: 'High', color: 'text-white bg-red-500 border-red-500 dark:bg-red-600 dark:border-red-600' })
    else if (vitals.blood_sugar > 100) alerts.push({ label: 'Sugar', value: `${vitals.blood_sugar} mg/dL`, status: 'Elevated', color: 'text-white bg-red-500 border-red-500 dark:bg-red-600 dark:border-red-600' })
  }

  // Pain score
  const pain = props.consultation.triage?.pain_score
  if (pain != null && pain >= 7) {
    alerts.push({ label: 'Pain', value: `${pain}/10`, status: 'High', color: 'text-white bg-red-500 border-red-500 dark:bg-red-600 dark:border-red-600' })
  }

  return alerts
})

const labOrderLabel = computed(() => {
  const summary = props.consultation.lab_order_summary
  if (!summary) return ''
  const all = [...summary.pending_items, ...summary.completed_items]
  if (all.length === 0) return ''
  if (all.length === 1) return all[0]
  return `${all[0]} and ${all.length - 1} more`
})

const narrativeSummary = computed(() => {
  const c = props.consultation
  return buildNarrative({
    id: c.id,
    complaint: c.triage?.chief_complaint,
    diagnoses: authStore.hasPermission('consultations.edit-assessment')
      ? (c.assessment?.diagnoses ?? []).map(d => d.description)
      : [],
    advice: authStore.hasPermission('consultations.edit-treatment-plan') ? c.treatment_plan?.advice : null,
    prescriptionItems: c.prescription_summary?.items,
  })
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
          <span class="rounded-md border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400">
            Draft
          </span>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <p v-if="narrativeSummary" class="mt-1 text-sm text-muted-foreground leading-relaxed" v-html="narrativeSummary" />
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
        <button
          v-if="consultation.lab_order_summary"
          type="button"
          class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          @click.stop="emit('show-lab-order', consultation.lab_order_summary!, $event)"
        >
          <FlaskConical class="size-3 shrink-0" />
          <span>{{ labOrderLabel }}</span>
          <Info class="size-3 shrink-0" />
        </button>
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
