<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { getAuthToken } from '@/lib/http'
import { AlertTriangle, CheckCircle2, History, LoaderCircle, TrendingUp, FlaskConical, Info } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { http } from '@/lib/http'
import type { ConsultationTriage, ConsultationResponse, LabOrderSummary } from '../types/consultation.types'
import { classifyBpAsStatus, classifyHr, classifyTemp, classifySpo2, classifyRr, classifyBloodSugar, classifyBmi } from '@/lib/vitals'
import { useVitalsConfigStore } from '@/stores/vitalsConfigStore'
import { labOrderApi } from '../api/labOrderApi'
import FinalizeModal from './FinalizeModal.vue'
import ChronicTrendsDialog from '@/domains/patient/components/ChronicTrendsDialog.vue'
import GrowthChartDialog from '@/domains/patient/components/specialties/pediatrics/GrowthChartDialog.vue'

interface PastDiagnosis {
  description: string
  code: string | null
  date: string
  encounterId: string
}

const props = defineProps<{
  triage: ConsultationTriage
  patientId?: string
  encounterId?: string
  showTrendsButton?: boolean
  labOrderSummary?: LabOrderSummary | null
  /** Hide the vitals badges + past diagnoses panel — only render the lab + trends footer row. */
  hideVitalsPanel?: boolean
  /** Encounter specialty — swaps the Trends dialog for a specialty-appropriate chart. */
  specialty?: string | null
}>()

// Pediatrics uses a Growth Chart (WHO percentiles) instead of the
// chronic-trends dialog (BP / BS / weight / BMI), which is meant for
// adult internal / family medicine.
const isPediatrics = computed(() => props.specialty === 'pediatrics')

const vitalsConfig = useVitalsConfigStore()

const pastDiagnoses = ref<PastDiagnosis[]>([])
const showTrends = ref(false)

function openTrends() {
  showTrends.value = true
}

// Lab result preview
const labPreviewOpen = ref(false)
const labPreviewFiles = ref<{ url: string; type: 'image' | 'pdf' }[]>([])
const labPreviewTitle = ref('')
const labPreviewIndex = ref(0)
const isLoadingLabPreview = ref(false)

async function viewLabResult(description: string) {
  if (!props.encounterId) return
  isLoadingLabPreview.value = true
  labPreviewTitle.value = description
  labPreviewIndex.value = 0
  labPreviewOpen.value = true

  try {
    const res = await labOrderApi.getForEncounter(props.encounterId)
    const item = res.data?.items.find((i) => i.description === description && i.status === 'completed')
    if (!item?.result_files.length) {
      labPreviewOpen.value = false
      return
    }

    const token = getAuthToken()
    const baseUrl = (import.meta.env.VITE_API_URL as string).replace(/\/api$/, '')
    const files = await Promise.all(
      item.result_files.map(async (fileUrl) => {
        const res = await fetch(`${baseUrl}${fileUrl}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        return {
          url: URL.createObjectURL(blob),
          type: (blob.type.startsWith('image/') ? 'image' : 'pdf') as 'image' | 'pdf',
        }
      }),
    )
    labPreviewFiles.value = files
  } catch {
    toast.error('Failed to load lab result')
    labPreviewOpen.value = false
  } finally {
    isLoadingLabPreview.value = false
  }
}

function onLabPreviewClose(open: boolean) {
  if (!open) {
    for (const f of labPreviewFiles.value) {
      URL.revokeObjectURL(f.url)
    }
    labPreviewFiles.value = []
  }
  labPreviewOpen.value = open
}

const showPreview = ref(false)
const previewConsultation = ref<ConsultationResponse | null>(null)
const isLoadingPreview = ref(false)

async function fetchPastDiagnoses() {
  if (!props.patientId) return
  try {
    const res = await http.get<{ data: ConsultationResponse[]; meta: unknown }>(
      `/patients/${props.patientId}/encounters?per_page=3&page=1`,
    )
    const diagnoses: PastDiagnosis[] = []
    let count = 0
    for (const c of res.data) {
      if (c.id === props.encounterId) continue
      if (c.status !== 'finalized') continue
      if (count >= 2) break
      for (const d of c.assessment?.diagnoses ?? []) {
        diagnoses.push({
          description: d.description,
          code: d.code,
          date: c.finalized_at ?? c.created_at,
          encounterId: c.id,
        })
      }
      count++
    }
    pastDiagnoses.value = diagnoses
  } catch {
    // silent
  }
}

async function openConsultationPreview(encounterId: string) {
  isLoadingPreview.value = true
  showPreview.value = true
  try {
    const res = await http.get<{ data: ConsultationResponse }>(`/consultations/${encounterId}`)
    previewConsultation.value = res.data
  } catch {
    showPreview.value = false
  } finally {
    isLoadingPreview.value = false
  }
}

onMounted(() => {
  fetchPastDiagnoses()
  loadLabThumbnails()
})

// ── Lab thumbnails ──────────────────────────────────────────────────────────
const labItemThumbnails = ref<Record<string, string>>({})

async function loadLabThumbnails() {
  if (!props.encounterId || !props.labOrderSummary?.completed_items?.length) return
  try {
    const res = await labOrderApi.getForEncounter(props.encounterId)
    const token = getAuthToken()
    const baseUrl = (import.meta.env.VITE_API_URL as string).replace(/\/api$/, '')

    for (const item of res.data?.items ?? []) {
      if (item.status !== 'completed' || !item.result_files.length) continue
      // Find first image file for thumbnail
      for (const fileUrl of item.result_files) {
        try {
          const fileRes = await fetch(`${baseUrl}${fileUrl}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: 'include',
          })
          if (!fileRes.ok) continue
          const blob = await fileRes.blob()
          if (blob.type.startsWith('image/')) {
            labItemThumbnails.value[item.description] = URL.createObjectURL(blob)
            break
          }
        } catch {
          // skip this file
        }
      }
    }
  } catch {
    // silent
  }
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const bmi = computed(() => {
  const w = props.triage.vitals?.weight as number | undefined
  const h = props.triage.vitals?.height as number | undefined
  if (!w || !h) return null
  const heightM = h / 100
  return +(w / (heightM * heightM)).toFixed(1)
})

const bmiCategory = computed(() => {
  const result = classifyBmi(bmi.value, vitalsConfig.config)
  if (!result) return null
  return { label: result.label, color: result.color }
})

const tempStatus = computed(() => {
  const s = classifyTemp(props.triage.vitals?.temp, vitalsConfig.config)
  if (!s) return null
  return { ...s, icon: s.severity === 'normal' ? CheckCircle2 : AlertTriangle }
})

const bpStatus = computed(() => {
  const s = classifyBpAsStatus(props.triage.vitals?.bp, vitalsConfig.config)
  if (!s) return null
  return { ...s, icon: s.severity === 'normal' ? CheckCircle2 : AlertTriangle }
})

const hrStatus = computed(() => {
  const s = classifyHr(props.triage.vitals?.hr, vitalsConfig.config)
  if (!s) return null
  return { ...s, icon: s.severity === 'normal' ? CheckCircle2 : AlertTriangle }
})

const spo2Status = computed(() => {
  const s = classifySpo2(props.triage.vitals?.spo2, vitalsConfig.config)
  if (!s) return null
  return { ...s, icon: s.severity === 'normal' ? CheckCircle2 : AlertTriangle }
})

const rrStatus = computed(() => {
  const s = classifyRr(props.triage.vitals?.rr, vitalsConfig.config)
  if (!s) return null
  return { ...s, icon: s.severity === 'normal' ? CheckCircle2 : AlertTriangle }
})

const bsStatus = computed(() => {
  const s = classifyBloodSugar(props.triage.vitals?.blood_sugar, vitalsConfig.config)
  if (!s) return null
  return { ...s, icon: s.severity === 'normal' ? CheckCircle2 : AlertTriangle }
})

const hasAnyVital = computed(() =>
  bmi.value !== null || tempStatus.value !== null || bpStatus.value !== null ||
  hrStatus.value !== null || spo2Status.value !== null || rrStatus.value !== null ||
  bsStatus.value !== null
)

const hasPastDiagnoses = computed(() => pastDiagnoses.value.length > 0)
const hasLabResults = computed(() => (props.labOrderSummary?.total ?? 0) > 0)
const BADGE_RED = 'text-white bg-red-500 border-red-500 dark:bg-red-600 dark:border-red-600'
const BADGE_AMBER = 'text-white bg-amber-500 border-amber-500 dark:bg-amber-600 dark:border-amber-600'
const BADGE_BLUE = 'text-white bg-blue-500 border-blue-500 dark:bg-blue-600 dark:border-blue-600'
const BADGE_GREEN = 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'

interface VitalBadge { label: string; value: string; status: string; badgeClass: string }

function severityToBadge(severity: string): string {
  if (severity === 'critical' || severity === 'high') return BADGE_RED
  if (severity === 'elevated') return BADGE_AMBER
  if (severity === 'low') return BADGE_BLUE
  return BADGE_GREEN
}

const vitalBadges = computed(() => {
  const vitals = props.triage.vitals
  if (!vitals) return []

  const badges: VitalBadge[] = []

  if (bmi.value !== null && bmiCategory.value) {
    const cfg = vitalsConfig.config
    const isNormal = bmi.value >= cfg.bmi_underweight && bmi.value < cfg.bmi_normal
    badges.push({
      label: 'BMI',
      value: `${bmi.value}`,
      status: bmiCategory.value.label,
      badgeClass: isNormal ? BADGE_GREEN : bmi.value < cfg.bmi_underweight ? BADGE_BLUE : bmi.value < cfg.bmi_overweight ? BADGE_AMBER : BADGE_RED,
    })
  }

  if (bpStatus.value) {
    badges.push({
      label: 'BP',
      value: vitals.bp ?? '',
      status: bpStatus.value.label,
      badgeClass: severityToBadge(bpStatus.value.severity),
    })
  }

  if (tempStatus.value) {
    badges.push({
      label: 'Temp',
      value: `${vitals.temp}°C`,
      status: tempStatus.value.label,
      badgeClass: severityToBadge(tempStatus.value.severity),
    })
  }

  if (hrStatus.value) {
    badges.push({
      label: 'HR',
      value: `${vitals.hr} bpm`,
      status: hrStatus.value.label,
      badgeClass: severityToBadge(hrStatus.value.severity),
    })
  }

  if (spo2Status.value) {
    badges.push({
      label: 'SpO2',
      value: `${vitals.spo2}%`,
      status: spo2Status.value.label,
      badgeClass: severityToBadge(spo2Status.value.severity),
    })
  }

  if (rrStatus.value) {
    badges.push({
      label: 'RR',
      value: `${vitals.rr}/min`,
      status: rrStatus.value.label,
      badgeClass: severityToBadge(rrStatus.value.severity),
    })
  }

  if (bsStatus.value) {
    badges.push({
      label: 'Sugar',
      value: `${vitals.blood_sugar} mg/dL`,
      status: bsStatus.value.label,
      badgeClass: severityToBadge(bsStatus.value.severity),
    })
  }

  return badges
})

const showDisclaimer = ref(false)

const hasAnything = computed(() => hasAnyVital.value || hasPastDiagnoses.value || hasLabResults.value)
</script>

<template>
  <TooltipProvider v-if="hasAnything || (hideVitalsPanel && (hasLabResults || showTrendsButton))" :delay-duration="200">
    <div v-if="!hideVitalsPanel" class="flex flex-col gap-2 rounded-md border bg-muted/30 px-3 py-2">
    <div v-if="hasAnyVital" class="flex flex-wrap items-center gap-1.5">
      <span
        v-for="badge in vitalBadges"
        :key="badge.label"
        class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium"
        :class="badge.badgeClass"
      >
        <AlertTriangle v-if="badge.status !== 'Normal'" class="size-3" />
        <CheckCircle2 v-else class="size-3" />
        {{ badge.label }}: {{ badge.value }}
        <span class="opacity-75">{{ badge.status }}</span>
      </span>
      <button
        type="button"
        class="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        @click="showDisclaimer = !showDisclaimer"
      >
        <Info class="size-3.5" />
      </button>
    </div>

    <!-- Clinical disclaimer -->
    <div
      v-if="showDisclaimer"
      class="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
    >
      <Info class="mt-0.5 size-3.5 shrink-0" />
      <p>
        Vital sign classifications are based on general clinical reference ranges and are intended as decision-support only.
        They do not account for patient-specific factors such as age, medical history, medications, or clinical context.
        Always exercise independent clinical judgment.
      </p>
    </div>

    <!-- Past Diagnoses -->
    <div v-if="hasPastDiagnoses" class="flex flex-col gap-1 text-xs">
      <span class="flex items-center gap-1 font-medium text-muted-foreground">
        <History class="size-3" />
        Recent Dx
      </span>
      <ul class="flex flex-col gap-0.5 pl-4">
        <li
          v-for="(dx, i) in pastDiagnoses"
          :key="i"
          class="list-disc text-muted-foreground"
        >
          <button
            type="button"
            class="text-left transition-colors hover:text-foreground"
            @click="openConsultationPreview(dx.encounterId)"
          >
            {{ dx.description }}<span v-if="dx.code" class="ml-0.5 opacity-60">({{ dx.code }})</span>
            <span class="ml-1 opacity-50">{{ formatShortDate(dx.date) }}</span>
          </button>
        </li>
      </ul>
    </div>
    </div>

    <!-- Lab results + Trends button row (square thumbnails) -->
    <div v-if="hasLabResults || showTrendsButton" class="flex flex-wrap items-center gap-2">
      <!-- Trends square button -->
      <Tooltip v-if="showTrendsButton">
        <TooltipTrigger as-child>
          <button
            type="button"
            class="flex size-24 flex-col items-center justify-center gap-1 rounded-xl border bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-sm transition-transform hover:scale-105 hover:shadow-md"
            @click="openTrends"
          >
            <TrendingUp class="size-8" />
            <span class="text-xs font-medium">Trends</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Patient Trends</TooltipContent>
      </Tooltip>

      <!-- Completed lab thumbnails -->
      <Tooltip v-for="item in labOrderSummary?.completed_items ?? []" :key="'done-' + item">
        <TooltipTrigger as-child>
          <button
            type="button"
            class="group relative flex size-24 items-center justify-center overflow-hidden rounded-xl border border-green-200 bg-green-50 text-xs font-medium text-green-700 shadow-sm transition-transform hover:scale-105 hover:shadow-md dark:border-green-800 dark:bg-green-950 dark:text-green-400"
            @click="viewLabResult(item)"
          >
            <img
              v-if="labItemThumbnails[item]"
              :src="labItemThumbnails[item]"
              :alt="item"
              class="size-full object-cover"
            />
            <div v-else class="flex flex-col items-center justify-center gap-1 px-2 text-center leading-tight">
              <FlaskConical class="size-6" />
              <span class="line-clamp-3 text-[11px]">{{ item }}</span>
            </div>
            <span class="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-green-500 text-white shadow-sm">
              <CheckCircle2 class="size-3.5" />
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{{ item }} — Result available</TooltipContent>
      </Tooltip>

      <!-- Pending lab items -->
      <Tooltip v-for="item in labOrderSummary?.pending_items ?? []" :key="'pending-' + item">
        <TooltipTrigger as-child>
          <div class="flex size-24 flex-col items-center justify-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2 text-center text-[11px] font-medium leading-tight text-amber-700 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
            <FlaskConical class="size-6" />
            <span class="line-clamp-3">{{ item }}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>{{ item }} — Pending result</TooltipContent>
      </Tooltip>
    </div>

    <!-- Trends Dialog — specialty-aware. Pediatrics gets the Growth Chart
         (WHO percentiles); everyone else gets ChronicTrends (BP / BS / weight / BMI). -->
    <GrowthChartDialog v-if="isPediatrics" v-model:open="showTrends" />
    <ChronicTrendsDialog v-else v-model:open="showTrends" />

    <!-- Lab Result Preview Modal -->
    <Dialog :open="labPreviewOpen" @update:open="onLabPreviewClose">
      <DialogContent class="flex max-h-[90vh] flex-col p-0 sm:max-w-2xl">
        <DialogHeader class="border-b px-6 py-4">
          <DialogTitle>{{ labPreviewTitle }}</DialogTitle>
          <DialogDescription class="sr-only">Lab result preview</DialogDescription>
        </DialogHeader>

        <div class="flex-1 overflow-auto p-6">
          <div v-if="isLoadingLabPreview" class="flex items-center justify-center py-12">
            <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
          </div>
          <template v-else-if="labPreviewFiles.length">
            <!-- Nav for multiple files -->
            <div v-if="labPreviewFiles.length > 1" class="mb-3 flex items-center justify-between text-sm text-muted-foreground">
              <button
                type="button"
                class="rounded px-2 py-1 hover:bg-accent disabled:opacity-30"
                :disabled="labPreviewIndex === 0"
                @click="labPreviewIndex--"
              >
                Previous
              </button>
              <span>{{ labPreviewIndex + 1 }} / {{ labPreviewFiles.length }}</span>
              <button
                type="button"
                class="rounded px-2 py-1 hover:bg-accent disabled:opacity-30"
                :disabled="labPreviewIndex === labPreviewFiles.length - 1"
                @click="labPreviewIndex++"
              >
                Next
              </button>
            </div>
            <iframe
              v-if="labPreviewFiles[labPreviewIndex].type === 'pdf'"
              :src="labPreviewFiles[labPreviewIndex].url"
              class="h-[70vh] w-full rounded border"
            />
            <img
              v-else
              :src="labPreviewFiles[labPreviewIndex].url"
              :alt="labPreviewTitle"
              class="w-full rounded"
            />
          </template>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Consultation Preview Modal -->
    <FinalizeModal
      v-if="previewConsultation"
      :open="showPreview"
      :consultation="previewConsultation"
      :is-saving="false"
      preview-only
      @update:open="showPreview = $event"
    />
    <Dialog v-if="isLoadingPreview && !previewConsultation" :open="showPreview" @update:open="showPreview = $event">
      <DialogContent class="flex items-center justify-center py-12">
        <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
      </DialogContent>
    </Dialog>
  </TooltipProvider>
</template>
