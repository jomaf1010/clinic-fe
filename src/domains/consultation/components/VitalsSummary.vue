<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { getAuthToken } from '@/lib/http'
import { AlertTriangle, CheckCircle2, History, LoaderCircle, TrendingUp, FlaskConical, Info } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartContainer, ChartCrosshair, type ChartConfig } from '@/components/ui/chart'
import { VisXYContainer, VisLine, VisAxis, VisArea, VisScatter, VisTooltip } from '@unovis/vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { http } from '@/lib/http'
import type { ConsultationTriage, ConsultationResponse, LabOrderSummary } from '../types/consultation.types'
import { classifyBpAsStatus, classifyHr, classifyTemp, classifySpo2, classifyRr, classifyBloodSugar, classifyBmi } from '@/lib/vitals'
import { useVitalsConfigStore } from '@/stores/vitalsConfigStore'
import { labOrderApi } from '../api/labOrderApi'
import FinalizeModal from './FinalizeModal.vue'

interface PastDiagnosis {
  description: string
  code: string | null
  date: string
  consultationId: string
}

const props = defineProps<{
  triage: ConsultationTriage
  patientId?: string
  consultationId?: string
  showTrendsButton?: boolean
  labOrderSummary?: LabOrderSummary | null
}>()

const vitalsConfig = useVitalsConfigStore()

const pastDiagnoses = ref<PastDiagnosis[]>([])
const showTrends = ref(false)
const isLoadingTrends = ref(false)

interface WeightDataPoint {
  date: string
  weight: number
}

interface BPDataPoint {
  date: string
  systolic: number
  diastolic: number
}

interface BSDataPoint {
  date: string
  blood_sugar: number
}

interface BMIDataPoint {
  date: string
  bmi: number
}

const weightData = ref<WeightDataPoint[]>([])
const bpData = ref<BPDataPoint[]>([])
const bsData = ref<BSDataPoint[]>([])
const bmiData = ref<BMIDataPoint[]>([])

function parseBPString(bp: string | null): { systolic: number; diastolic: number } | null {
  if (!bp) return null
  const match = bp.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!match) return null
  return { systolic: parseInt(match[1]), diastolic: parseInt(match[2]) }
}

async function openTrends() {
  showTrends.value = true
  if (weightData.value.length > 0 || bpData.value.length > 0 || bsData.value.length > 0) return
  if (!props.patientId) return

  isLoadingTrends.value = true
  try {
    const pages = [1, 2, 3, 4, 5]
    const weightPoints: WeightDataPoint[] = []
    const bpPoints: BPDataPoint[] = []
    const bsPoints: BSDataPoint[] = []
    const bmiPoints: BMIDataPoint[] = []

    for (const page of pages) {
      if (weightPoints.length >= 50 && bpPoints.length >= 50 && bsPoints.length >= 50) break
      const res = await http.get<{ data: ConsultationResponse[]; meta: { pagination: { last_page: number } } }>(
        `/patients/${props.patientId}/encounters?per_page=10&page=${page}`,
      )
      for (const c of res.data) {
        const date = (c.finalized_at ?? c.created_at).split('T')[0]
        const weight = c.triage?.vitals?.weight as number | undefined
        const height = c.triage?.vitals?.height as number | undefined
        if (weight && weight > 0 && weightPoints.length < 50) {
          weightPoints.push({ date, weight })
        }
        // BMI from weight + height
        if (weight && weight > 0 && height && height > 0 && bmiPoints.length < 50) {
          const heightM = height / 100
          bmiPoints.push({ date, bmi: +(weight / (heightM * heightM)).toFixed(1) })
        }
        // BP: try paired fields first (specialty system), then combined string
        const vitals = c.triage?.vitals
        const bpSys = vitals?.bp_systolic as number | undefined
        const bpDia = vitals?.bp_diastolic as number | undefined
        if (bpSys && bpDia && bpPoints.length < 50) {
          bpPoints.push({ date, systolic: bpSys, diastolic: bpDia })
        } else {
          const bp = parseBPString(vitals?.bp ?? null)
          if (bp && bpPoints.length < 50) {
            bpPoints.push({ date, systolic: bp.systolic, diastolic: bp.diastolic })
          }
        }
        if (vitals?.blood_sugar && vitals.blood_sugar > 0 && bsPoints.length < 50) {
          bsPoints.push({ date, blood_sugar: vitals.blood_sugar })
        }
      }
      if (page >= res.meta.pagination.last_page) break
    }

    weightData.value = weightPoints.reverse()
    bpData.value = bpPoints.reverse()
    bsData.value = bsPoints.reverse()
    bmiData.value = bmiPoints.reverse()
  } catch {
    // silent
  } finally {
    isLoadingTrends.value = false
  }
}

const weightChartConfig: ChartConfig = {
  weight: { label: 'Weight (kg)', color: 'hsl(var(--chart-1))' },
}
const weightX = (_: WeightDataPoint, i: number) => i
const weightY = (d: WeightDataPoint) => d.weight

const bpChartConfig: ChartConfig = {
  systolic: { label: 'Systolic', color: 'hsl(var(--chart-2))' },
  diastolic: { label: 'Diastolic', color: 'hsl(var(--chart-3))' },
}
const bpX = (_: BPDataPoint, i: number) => i
const bpSystolic = (d: BPDataPoint) => d.systolic
const bpDiastolic = (d: BPDataPoint) => d.diastolic

function bpStatusColor(systolic: number, diastolic: number): { label: string; color: string } {
  const s = classifyBpAsStatus(`${systolic}/${diastolic}`, vitalsConfig.config)
  if (!s || s.severity === 'normal') return { label: 'Normal', color: '#16a34a' }
  if (s.severity === 'elevated' || s.severity === 'low') return { label: s.label, color: '#d97706' }
  return { label: s.label, color: '#dc2626' }
}

function bpTooltipTemplate(d: BPDataPoint): string {
  const date = new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const status = bpStatusColor(d.systolic, d.diastolic)
  return `<div style="background: var(--popover); border: 1px solid ${status.color}40; border-radius: 6px; padding: 8px 12px; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.1);">
    <div style="font-weight: 600; font-variant-numeric: tabular-nums;">${d.systolic}/${d.diastolic} mmHg</div>
    <div style="color: ${status.color}; font-weight: 500; margin-top: 2px;">${status.label}</div>
    <div style="color: var(--muted-foreground); margin-top: 2px;">${date}</div>
  </div>`
}

function weightBmiStatus(weight: number): { label: string; color: string } | null {
  const height = props.triage.vitals?.height as number | undefined
  if (!height) return null
  const heightM = height / 100
  const bmiVal = weight / (heightM * heightM)
  const cfg = vitalsConfig.config
  if (bmiVal < cfg.bmi_underweight) return { label: `BMI ${bmiVal.toFixed(1)} · Underweight`, color: '#2563eb' }
  if (bmiVal < cfg.bmi_normal)      return { label: `BMI ${bmiVal.toFixed(1)} · Normal`, color: '#16a34a' }
  if (bmiVal < cfg.bmi_overweight)  return { label: `BMI ${bmiVal.toFixed(1)} · Overweight`, color: '#d97706' }
  return { label: `BMI ${bmiVal.toFixed(1)} · Obese`, color: '#dc2626' }
}

const bmiChartConfig: ChartConfig = {
  bmi: { label: 'BMI', color: 'hsl(var(--chart-5))' },
}
const bmiX = (_: BMIDataPoint, i: number) => i
const bmiY = (d: BMIDataPoint) => d.bmi

function bmiTooltipTemplate(d: BMIDataPoint): string {
  const date = new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const status = classifyBmi(d.bmi, vitalsConfig.config)
  const borderColor = status ? `${status.color}40` : 'var(--border)'
  return `<div style="background: var(--popover); border: 1px solid ${borderColor}; border-radius: 6px; padding: 8px 12px; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.1);">
    <div style="font-weight: 600; font-variant-numeric: tabular-nums;">BMI ${d.bmi}</div>
    ${status ? `<div style="color: ${status.color}; font-weight: 500; margin-top: 2px;">${status.label}</div>` : ''}
    <div style="color: var(--muted-foreground); margin-top: 2px;">${date}</div>
  </div>`
}

const bsChartConfig: ChartConfig = {
  blood_sugar: { label: 'Blood Sugar (mg/dL)', color: 'hsl(var(--chart-4))' },
}
const bsX = (_: BSDataPoint, i: number) => i
const bsY = (d: BSDataPoint) => d.blood_sugar

function bsStatusColor(val: number): { label: string; color: string } {
  const s = classifyBloodSugar(val, vitalsConfig.config)
  if (!s || s.severity === 'normal') return { label: 'Normal', color: '#16a34a' }
  if (s.severity === 'low') return { label: s.label, color: '#2563eb' }
  if (s.severity === 'elevated') return { label: s.label, color: '#d97706' }
  return { label: s.label, color: '#dc2626' }
}

function bsTooltipTemplate(d: BSDataPoint): string {
  const date = new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const status = bsStatusColor(d.blood_sugar)
  return `<div style="background: var(--popover); border: 1px solid ${status.color}40; border-radius: 6px; padding: 8px 12px; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.1);">
    <div style="font-weight: 600; font-variant-numeric: tabular-nums;">${d.blood_sugar} mg/dL</div>
    <div style="color: ${status.color}; font-weight: 500; margin-top: 2px;">${status.label}</div>
    <div style="color: var(--muted-foreground); margin-top: 2px;">${date}</div>
  </div>`
}

function weightTooltipTemplate(d: WeightDataPoint): string {
  const date = new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const status = weightBmiStatus(d.weight)
  const borderColor = status ? `${status.color}40` : 'var(--border)'
  return `<div style="background: var(--popover); border: 1px solid ${borderColor}; border-radius: 6px; padding: 8px 12px; font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.1);">
    <div style="font-weight: 600; font-variant-numeric: tabular-nums;">${d.weight} kg</div>
    ${status ? `<div style="color: ${status.color}; font-weight: 500; margin-top: 2px;">${status.label}</div>` : ''}
    <div style="color: var(--muted-foreground); margin-top: 2px;">${date}</div>
  </div>`
}

// Lab result preview
const labPreviewOpen = ref(false)
const labPreviewFiles = ref<{ url: string; type: 'image' | 'pdf' }[]>([])
const labPreviewTitle = ref('')
const labPreviewIndex = ref(0)
const isLoadingLabPreview = ref(false)

async function viewLabResult(description: string) {
  if (!props.consultationId) return
  isLoadingLabPreview.value = true
  labPreviewTitle.value = description
  labPreviewIndex.value = 0
  labPreviewOpen.value = true

  try {
    const res = await labOrderApi.getForEncounter(props.consultationId)
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
      if (c.id === props.consultationId) continue
      if (c.status !== 'finalized') continue
      if (count >= 2) break
      for (const d of c.assessment?.diagnoses ?? []) {
        diagnoses.push({
          description: d.description,
          code: d.code,
          date: c.finalized_at ?? c.created_at,
          consultationId: c.id,
        })
      }
      count++
    }
    pastDiagnoses.value = diagnoses
  } catch {
    // silent
  }
}

async function openConsultationPreview(consultationId: string) {
  isLoadingPreview.value = true
  showPreview.value = true
  try {
    const res = await http.get<{ data: ConsultationResponse }>(`/consultations/${consultationId}`)
    previewConsultation.value = res.data
  } catch {
    showPreview.value = false
  } finally {
    isLoadingPreview.value = false
  }
}

onMounted(fetchPastDiagnoses)

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
  <TooltipProvider v-if="hasAnything" :delay-duration="200">
    <div class="flex flex-col gap-2 rounded-md border bg-muted/30 px-3 py-2">
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
            @click="openConsultationPreview(dx.consultationId)"
          >
            {{ dx.description }}<span v-if="dx.code" class="ml-0.5 opacity-60">({{ dx.code }})</span>
            <span class="ml-1 opacity-50">{{ formatShortDate(dx.date) }}</span>
          </button>
        </li>
      </ul>
    </div>
    </div>

    <!-- Lab results + Trends button row -->
    <div v-if="hasLabResults || showTrendsButton" class="flex flex-wrap items-center gap-1.5 -mt-1 text-xs">
      <template v-if="hasLabResults">
        <span class="flex items-center gap-1 font-medium text-muted-foreground">
          <FlaskConical class="size-3" />
          Lab
        </span>
        <button
          v-for="item in labOrderSummary!.completed_items"
          :key="'done-' + item"
          type="button"
          class="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-green-700 transition-colors hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900"
          @click="viewLabResult(item)"
        >
          {{ item }} ✓
        </button>
        <span
          v-for="item in labOrderSummary!.pending_items"
          :key="'pending-' + item"
          class="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
        >
          {{ item }}
        </span>
      </template>
      <Button
        v-if="showTrendsButton"
        variant="outline"
        size="sm"
        class="h-6 gap-1 px-2 text-xs"
        @click="openTrends"
      >
        <TrendingUp class="size-3" />
        Trends
      </Button>
    </div>

    <!-- Trends Modal -->
    <Dialog :open="showTrends" @update:open="showTrends = $event">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <TrendingUp class="size-5 text-primary" />
            Patient Trends
          </DialogTitle>
          <DialogDescription>
            Weight trend over past consultations.
          </DialogDescription>
        </DialogHeader>

        <!-- Loading -->
        <div v-if="isLoadingTrends" class="flex items-center justify-center py-12">
          <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
        </div>

        <!-- No data -->
        <div v-else-if="weightData.length === 0 && bpData.length === 0 && bsData.length === 0 && bmiData.length === 0" class="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div class="flex size-12 items-center justify-center rounded-full bg-muted">
            <TrendingUp class="size-6 text-muted-foreground" />
          </div>
          <p class="text-sm font-medium text-muted-foreground">No vitals data available</p>
          <p class="text-xs text-muted-foreground">Charts will appear once vitals are recorded in triage.</p>
        </div>

        <!-- Charts in tabs -->
        <Tabs v-else default-value="weight" class="w-full">
          <TabsList class="w-full">
            <TabsTrigger v-if="weightData.length > 0" value="weight" class="flex-1">
              Weight
              <span class="ml-1 text-xs text-muted-foreground">({{ weightData.length }})</span>
            </TabsTrigger>
            <TabsTrigger v-if="bpData.length > 0" value="bp" class="flex-1">
              Blood Pressure
              <span class="ml-1 text-xs text-muted-foreground">({{ bpData.length }})</span>
            </TabsTrigger>
            <TabsTrigger v-if="bsData.length > 0" value="bs" class="flex-1">
              Blood Sugar
              <span class="ml-1 text-xs text-muted-foreground">({{ bsData.length }})</span>
            </TabsTrigger>
            <TabsTrigger v-if="bmiData.length > 0" value="bmi" class="flex-1">
              BMI
              <span class="ml-1 text-xs text-muted-foreground">({{ bmiData.length }})</span>
            </TabsTrigger>
          </TabsList>

          <!-- Weight chart -->
          <TabsContent v-if="weightData.length > 0" value="weight" class="mt-3">
            <ChartContainer :config="weightChartConfig" class="h-[300px] w-full">
              <VisXYContainer :data="weightData" :margin="{ top: 10, right: 10, bottom: 30, left: 40 }">
                <VisArea
                  :x="weightX"
                  :y="weightY"
                  color="hsl(var(--chart-1))"
                  :opacity="0.1"
                />
                <VisLine
                  :x="weightX"
                  :y="weightY"
                  color="hsl(var(--chart-1))"
                  :line-width="2"
                />
                <VisScatter
                  :x="weightX"
                  :y="weightY"
                  color="hsl(var(--chart-1))"
                  :size="5"
                />
                <VisAxis
                  type="x"
                  :tick-format="(i: number) => weightData[i]?.date ? new Date(weightData[i].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''"
                  :num-ticks="Math.min(weightData.length, 8)"
                  :grid-line="false"
                />
                <VisAxis
                  type="y"
                  :tick-format="(v: number) => `${v}kg`"
                  :grid-line="true"
                />
                <ChartCrosshair color="hsl(var(--chart-1))" :template="weightTooltipTemplate" />
                <VisTooltip :horizontal-shift="10" :vertical-shift="10" />
              </VisXYContainer>
            </ChartContainer>
          </TabsContent>

          <!-- Blood Pressure chart -->
          <TabsContent v-if="bpData.length > 0" value="bp" class="mt-3">
            <ChartContainer :config="bpChartConfig" class="h-[300px] w-full">
              <VisXYContainer :data="bpData" :margin="{ top: 10, right: 10, bottom: 30, left: 40 }">
                <VisArea
                  :x="bpX"
                  :y="bpSystolic"
                  color="hsl(var(--chart-2))"
                  :opacity="0.08"
                />
                <VisLine
                  :x="bpX"
                  :y="bpSystolic"
                  color="hsl(var(--chart-2))"
                  :line-width="2"
                />
                <VisScatter
                  :x="bpX"
                  :y="bpSystolic"
                  color="hsl(var(--chart-2))"
                  :size="4"
                />
                <VisArea
                  :x="bpX"
                  :y="bpDiastolic"
                  color="hsl(var(--chart-3))"
                  :opacity="0.08"
                />
                <VisLine
                  :x="bpX"
                  :y="bpDiastolic"
                  color="hsl(var(--chart-3))"
                  :line-width="2"
                />
                <VisScatter
                  :x="bpX"
                  :y="bpDiastolic"
                  color="hsl(var(--chart-3))"
                  :size="4"
                />
                <VisAxis
                  type="x"
                  :tick-format="(i: number) => bpData[i]?.date ? new Date(bpData[i].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''"
                  :num-ticks="Math.min(bpData.length, 8)"
                  :grid-line="false"
                />
                <VisAxis
                  type="y"
                  :grid-line="true"
                />
                <ChartCrosshair color="hsl(var(--chart-2))" :template="bpTooltipTemplate" />
                <VisTooltip :horizontal-shift="10" :vertical-shift="10" />
              </VisXYContainer>
            </ChartContainer>
            <div class="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span class="flex items-center gap-1.5">
                <span class="size-2 rounded-full" style="background: hsl(var(--chart-2))" />
                Systolic
              </span>
              <span class="flex items-center gap-1.5">
                <span class="size-2 rounded-full" style="background: hsl(var(--chart-3))" />
                Diastolic
              </span>
            </div>
          </TabsContent>

          <!-- Blood Sugar chart -->
          <TabsContent v-if="bsData.length > 0" value="bs" class="mt-3">
            <ChartContainer :config="bsChartConfig" class="h-[300px] w-full">
              <VisXYContainer :data="bsData" :margin="{ top: 10, right: 10, bottom: 30, left: 40 }">
                <VisArea
                  :x="bsX"
                  :y="bsY"
                  color="hsl(var(--chart-4))"
                  :opacity="0.1"
                />
                <VisLine
                  :x="bsX"
                  :y="bsY"
                  color="hsl(var(--chart-4))"
                  :line-width="2"
                />
                <VisScatter
                  :x="bsX"
                  :y="bsY"
                  color="hsl(var(--chart-4))"
                  :size="5"
                />
                <VisAxis
                  type="x"
                  :tick-format="(i: number) => bsData[i]?.date ? new Date(bsData[i].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''"
                  :num-ticks="Math.min(bsData.length, 8)"
                  :grid-line="false"
                />
                <VisAxis
                  type="y"
                  :tick-format="(v: number) => `${v}`"
                  :grid-line="true"
                />
                <ChartCrosshair color="hsl(var(--chart-4))" :template="bsTooltipTemplate" />
                <VisTooltip :horizontal-shift="10" :vertical-shift="10" />
              </VisXYContainer>
            </ChartContainer>
          </TabsContent>

          <!-- BMI chart -->
          <TabsContent v-if="bmiData.length > 0" value="bmi" class="mt-3">
            <ChartContainer :config="bmiChartConfig" class="h-[300px] w-full">
              <VisXYContainer :data="bmiData" :margin="{ top: 10, right: 10, bottom: 30, left: 40 }">
                <VisArea
                  :x="bmiX"
                  :y="bmiY"
                  color="hsl(var(--chart-5))"
                  :opacity="0.1"
                />
                <VisLine
                  :x="bmiX"
                  :y="bmiY"
                  color="hsl(var(--chart-5))"
                  :line-width="2"
                />
                <VisScatter
                  :x="bmiX"
                  :y="bmiY"
                  color="hsl(var(--chart-5))"
                  :size="5"
                />
                <VisAxis
                  type="x"
                  :tick-format="(i: number) => bmiData[i]?.date ? new Date(bmiData[i].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''"
                  :num-ticks="Math.min(bmiData.length, 8)"
                  :grid-line="false"
                />
                <VisAxis
                  type="y"
                  :tick-format="(v: number) => `${v}`"
                  :grid-line="true"
                />
                <ChartCrosshair color="hsl(var(--chart-5))" :template="bmiTooltipTemplate" />
                <VisTooltip :horizontal-shift="10" :vertical-shift="10" />
              </VisXYContainer>
            </ChartContainer>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" @click="showTrends = false">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

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
