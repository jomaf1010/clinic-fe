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
import { classifyBpString, classifyHr, classifyTemp, classifySpo2, classifyRr, classifyBloodSugar, classifyPain } from '@/lib/vitals'
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

const BADGE_RED = 'text-white bg-red-500 border-red-500 dark:bg-red-600 dark:border-red-600'
const BADGE_AMBER = 'text-white bg-amber-500 border-amber-500 dark:bg-amber-600 dark:border-amber-600'

function badgeColor(severity: string): string {
  if (severity === 'critical' || severity === 'high') return BADGE_RED
  return BADGE_AMBER
}

const abnormalVitals = computed(() => {
  const vitals = props.consultation.triage?.vitals
  if (!vitals) return []

  const alerts: VitalAlert[] = []

  const bp = classifyBpString(vitals.bp)
  if (bp && bp.severity >= 1) {
    alerts.push({ label: 'BP', value: `${vitals.bp} · ${bp.label}`, status: bp.label, color: bp.severity >= 2 ? BADGE_RED : BADGE_AMBER })
  }

  const hr = classifyHr(vitals.hr)
  if (hr && hr.severity !== 'normal') {
    alerts.push({ label: 'HR', value: `${vitals.hr} bpm`, status: hr.label, color: badgeColor(hr.severity) })
  }

  const temp = classifyTemp(vitals.temp)
  if (temp && temp.severity !== 'normal') {
    alerts.push({ label: 'Temp', value: `${vitals.temp}°C`, status: temp.label, color: badgeColor(temp.severity) })
  }

  const spo2 = classifySpo2(vitals.spo2)
  if (spo2 && spo2.severity !== 'normal') {
    alerts.push({ label: 'SpO2', value: `${vitals.spo2}%`, status: spo2.label, color: badgeColor(spo2.severity) })
  }

  const rr = classifyRr(vitals.rr)
  if (rr && rr.severity !== 'normal') {
    alerts.push({ label: 'RR', value: `${vitals.rr}/min`, status: rr.label, color: badgeColor(rr.severity) })
  }

  const bs = classifyBloodSugar(vitals.blood_sugar)
  if (bs && bs.severity !== 'normal') {
    alerts.push({ label: 'Sugar', value: `${vitals.blood_sugar} mg/dL`, status: bs.label, color: badgeColor(bs.severity) })
  }

  const pain = classifyPain(props.consultation.triage?.pain_score)
  if (pain) {
    alerts.push({ label: 'Pain', value: `${props.consultation.triage?.pain_score}/10`, status: pain.label, color: BADGE_RED })
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

const isOwner = computed(() => authStore.currentClinic?.role === 'owner')
const isMine = computed(() => props.consultation.created_by === authStore.user?.id)
const canEditTriage = computed(() => authStore.hasPermission('consultations.edit-triage'))
const canContinue = computed(() => isMine.value || isOwner.value || canEditTriage.value)

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
          <span v-if="consultation.type === 'follow_up'" class="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">Follow-up</span>
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
        <Button v-if="canContinue" variant="secondary" size="sm" class="mt-3 gap-1.5" @click.stop="openDraft">
          <PlayCircle class="size-3.5" />
          {{ isMine || isOwner ? 'Continue' : 'Edit Triage' }}
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
