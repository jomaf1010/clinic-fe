<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { AlertTriangle, CheckCircle2, ShieldAlert, HeartPulse, History, LoaderCircle, TrendingUp, FlaskConical } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartContainer, ChartCrosshair, type ChartConfig } from '@/components/ui/chart'
import { VisXYContainer, VisLine, VisAxis, VisArea, VisScatter, VisTooltip } from '@unovis/vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { http } from '@/lib/http'
import type { ConsultationTriage, ConsultationResponse, LabOrderSummary } from '../types/consultation.types'
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
  allergies?: string[]
  conditions?: string[]
  patientId?: string
  consultationId?: string
  showTrendsButton?: boolean
  labOrderSummary?: LabOrderSummary | null
}>()

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

const weightData = ref<WeightDataPoint[]>([])
const bpData = ref<BPDataPoint[]>([])
const bsData = ref<BSDataPoint[]>([])

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

    for (const page of pages) {
      if (weightPoints.length >= 50 && bpPoints.length >= 50 && bsPoints.length >= 50) break
      const res = await http.get<{ data: ConsultationResponse[]; meta: { pagination: { last_page: number } } }>(
        `/patients/${props.patientId}/consultations?per_page=10&page=${page}`,
      )
      for (const c of res.data) {
        const date = (c.finalized_at ?? c.created_at).split('T')[0]
        if (c.triage?.weight && c.triage.weight > 0 && weightPoints.length < 50) {
          weightPoints.push({ date, weight: c.triage.weight })
        }
        const bp = parseBPString(c.triage?.vitals?.bp ?? null)
        if (bp && bpPoints.length < 50) {
          bpPoints.push({ date, systolic: bp.systolic, diastolic: bp.diastolic })
        }
        if (c.triage?.vitals?.blood_sugar && c.triage.vitals.blood_sugar > 0 && bsPoints.length < 50) {
          bsPoints.push({ date, blood_sugar: c.triage.vitals.blood_sugar })
        }
      }
      if (page >= res.meta.pagination.last_page) break
    }

    weightData.value = weightPoints.reverse()
    bpData.value = bpPoints.reverse()
    bsData.value = bsPoints.reverse()
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
  if (systolic < 90 || diastolic < 60) return { label: 'Low', color: '#2563eb' }
  if (systolic <= 120 && diastolic <= 80) return { label: 'Normal', color: '#16a34a' }
  if (systolic <= 139 || diastolic <= 89) return { label: 'Elevated', color: '#d97706' }
  return { label: 'High', color: '#dc2626' }
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
  const height = props.triage.height
  if (!height) return null
  const heightM = height / 100
  const bmiVal = weight / (heightM * heightM)
  if (bmiVal < 18.5) return { label: `BMI ${bmiVal.toFixed(1)} · Underweight`, color: '#2563eb' }
  if (bmiVal < 25) return { label: `BMI ${bmiVal.toFixed(1)} · Normal`, color: '#16a34a' }
  if (bmiVal < 30) return { label: `BMI ${bmiVal.toFixed(1)} · Overweight`, color: '#d97706' }
  return { label: `BMI ${bmiVal.toFixed(1)} · Obese`, color: '#dc2626' }
}

const bsChartConfig: ChartConfig = {
  blood_sugar: { label: 'Blood Sugar (mg/dL)', color: 'hsl(var(--chart-4))' },
}
const bsX = (_: BSDataPoint, i: number) => i
const bsY = (d: BSDataPoint) => d.blood_sugar

function bsStatusColor(val: number): { label: string; color: string } {
  if (val < 70) return { label: 'Low (Hypoglycemia)', color: '#2563eb' }
  if (val <= 100) return { label: 'Normal', color: '#16a34a' }
  if (val <= 125) return { label: 'Pre-diabetic', color: '#d97706' }
  return { label: 'High (Diabetic)', color: '#dc2626' }
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
    const res = await labOrderApi.getForConsultation(props.consultationId)
    const item = res.data?.items.find((i) => i.description === description && i.status === 'completed')
    if (!item?.result_files.length) {
      labPreviewOpen.value = false
      return
    }

    const token = localStorage.getItem('auth_token')
    const baseUrl = (import.meta.env.VITE_API_URL as string).replace(/\/api$/, '')
    const files = await Promise.all(
      item.result_files.map(async (fileUrl) => {
        const res = await fetch(`${baseUrl}${fileUrl}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
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
      `/patients/${props.patientId}/consultations?per_page=3&page=1`,
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

function parseBP(bp: string | null): { systolic: number; diastolic: number } | null {
  if (!bp) return null
  const match = bp.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!match) return null
  return { systolic: parseInt(match[1]), diastolic: parseInt(match[2]) }
}

const bmi = computed(() => {
  if (!props.triage.weight || !props.triage.height) return null
  const heightM = props.triage.height / 100
  return +(props.triage.weight / (heightM * heightM)).toFixed(1)
})

const bmiCategory = computed(() => {
  if (bmi.value === null) return null
  if (bmi.value < 18.5) return { label: 'Underweight', color: 'text-blue-600' }
  if (bmi.value < 25) return { label: 'Normal', color: 'text-green-600' }
  if (bmi.value < 30) return { label: 'Overweight', color: 'text-amber-600' }
  return { label: 'Obese', color: 'text-red-600' }
})

const tempStatus = computed(() => {
  if (props.triage.vitals?.temp === null || props.triage.vitals?.temp === undefined) return null
  if (props.triage.vitals.temp < 36) return { label: 'Hypothermia', color: 'text-blue-600', icon: AlertTriangle }
  if (props.triage.vitals.temp <= 37.5) return { label: 'Normal', color: 'text-green-600', icon: CheckCircle2 }
  if (props.triage.vitals.temp <= 38.5) return { label: 'Low-grade fever', color: 'text-amber-600', icon: AlertTriangle }
  return { label: 'High fever', color: 'text-red-600', icon: AlertTriangle }
})

const bpStatus = computed(() => {
  const parsed = parseBP(props.triage.vitals?.bp ?? null)
  if (!parsed) return null
  const { systolic, diastolic } = parsed
  if (systolic < 90 || diastolic < 60) return { label: 'Low', color: 'text-blue-600', icon: AlertTriangle }
  if (systolic <= 120 && diastolic <= 80) return { label: 'Normal', color: 'text-green-600', icon: CheckCircle2 }
  if (systolic <= 139 || diastolic <= 89) return { label: 'Elevated', color: 'text-amber-600', icon: AlertTriangle }
  return { label: 'High', color: 'text-red-600', icon: AlertTriangle }
})

const hrStatus = computed(() => {
  if (props.triage.vitals?.hr === null || props.triage.vitals?.hr === undefined) return null
  if (props.triage.vitals.hr < 60) return { label: 'Bradycardia', color: 'text-blue-600', icon: AlertTriangle }
  if (props.triage.vitals.hr <= 100) return { label: 'Normal', color: 'text-green-600', icon: CheckCircle2 }
  return { label: 'Tachycardia', color: 'text-red-600', icon: AlertTriangle }
})

const spo2Status = computed(() => {
  if (props.triage.vitals?.spo2 === null || props.triage.vitals?.spo2 === undefined) return null
  if (props.triage.vitals.spo2 >= 95) return { label: 'Normal', color: 'text-green-600', icon: CheckCircle2 }
  if (props.triage.vitals.spo2 >= 90) return { label: 'Low', color: 'text-amber-600', icon: AlertTriangle }
  return { label: 'Critical', color: 'text-red-600', icon: AlertTriangle }
})

const rrStatus = computed(() => {
  if (props.triage.vitals?.rr === null || props.triage.vitals?.rr === undefined) return null
  if (props.triage.vitals.rr < 12) return { label: 'Low', color: 'text-blue-600', icon: AlertTriangle }
  if (props.triage.vitals.rr <= 20) return { label: 'Normal', color: 'text-green-600', icon: CheckCircle2 }
  return { label: 'Elevated', color: 'text-red-600', icon: AlertTriangle }
})

const bsStatus = computed(() => {
  if (props.triage.vitals?.blood_sugar === null || props.triage.vitals?.blood_sugar === undefined) return null
  if (props.triage.vitals.blood_sugar < 70) return { label: 'Low', color: 'text-blue-600', icon: AlertTriangle }
  if (props.triage.vitals.blood_sugar <= 100) return { label: 'Normal', color: 'text-green-600', icon: CheckCircle2 }
  if (props.triage.vitals.blood_sugar <= 125) return { label: 'Pre-diabetic', color: 'text-amber-600', icon: AlertTriangle }
  return { label: 'High', color: 'text-red-600', icon: AlertTriangle }
})

const hasAllergies = computed(() => (props.allergies?.length ?? 0) > 0)
const hasConditions = computed(() => (props.conditions?.length ?? 0) > 0)

const hasAnyVital = computed(() =>
  bmi.value !== null || tempStatus.value !== null || bpStatus.value !== null ||
  hrStatus.value !== null || spo2Status.value !== null || rrStatus.value !== null ||
  bsStatus.value !== null
)

const hasPastDiagnoses = computed(() => pastDiagnoses.value.length > 0)
const hasLabResults = computed(() => (props.labOrderSummary?.total ?? 0) > 0)
const hasAnything = computed(() => hasAnyVital.value || hasAllergies.value || hasConditions.value || hasPastDiagnoses.value || hasLabResults.value)
</script>

<template>
  <TooltipProvider v-if="hasAnything" :delay-duration="200">
    <div class="flex flex-col gap-2 rounded-md border bg-muted/30 px-3 py-2">
    <div v-if="hasAnyVital" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs [&>span.sep]:h-3 [&>span.sep]:w-px [&>span.sep]:bg-border">
      <span class="font-medium text-muted-foreground">Vitals</span>
      <span class="sep" />

      <Tooltip v-if="bmi !== null">
        <TooltipTrigger as-child>
          <span class="flex cursor-help items-center gap-1">
            BMI {{ bmi }} <span :class="bmiCategory?.color" class="font-medium">{{ bmiCategory?.label }}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="max-w-56 text-xs">
          <p class="font-medium">BMI Reference</p>
          <p>&lt;18.5 Underweight</p>
          <p>18.5–24.9 Normal</p>
          <p>25–29.9 Overweight</p>
          <p>≥30 Obese</p>
        </TooltipContent>
      </Tooltip>

      <span v-if="bpStatus" class="sep" />
      <Tooltip v-if="bpStatus">
        <TooltipTrigger as-child>
          <span class="flex cursor-help items-center gap-1">
            <component :is="bpStatus.icon" :class="bpStatus.color" class="size-3" />
            BP <span :class="bpStatus.color" class="font-medium">{{ bpStatus.label }}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="max-w-56 text-xs">
          <p class="font-medium">Blood Pressure (mmHg)</p>
          <p>&lt;90/60 Low</p>
          <p>90/60–120/80 Normal</p>
          <p>121/81–139/89 Elevated</p>
          <p>≥140/90 High</p>
        </TooltipContent>
      </Tooltip>

      <span v-if="tempStatus" class="sep" />
      <Tooltip v-if="tempStatus">
        <TooltipTrigger as-child>
          <span class="flex cursor-help items-center gap-1">
            <component :is="tempStatus.icon" :class="tempStatus.color" class="size-3" />
            Temp <span :class="tempStatus.color" class="font-medium">{{ tempStatus.label }}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="max-w-56 text-xs">
          <p class="font-medium">Temperature (°C)</p>
          <p>&lt;36 Hypothermia</p>
          <p>36–37.5 Normal</p>
          <p>37.6–38.5 Low-grade fever</p>
          <p>&gt;38.5 High fever</p>
        </TooltipContent>
      </Tooltip>

      <span v-if="hrStatus" class="sep" />
      <Tooltip v-if="hrStatus">
        <TooltipTrigger as-child>
          <span class="flex cursor-help items-center gap-1">
            <component :is="hrStatus.icon" :class="hrStatus.color" class="size-3" />
            HR <span :class="hrStatus.color" class="font-medium">{{ hrStatus.label }}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="max-w-56 text-xs">
          <p class="font-medium">Heart Rate (bpm)</p>
          <p>&lt;60 Bradycardia</p>
          <p>60–100 Normal</p>
          <p>&gt;100 Tachycardia</p>
        </TooltipContent>
      </Tooltip>

      <span v-if="spo2Status" class="sep" />
      <Tooltip v-if="spo2Status">
        <TooltipTrigger as-child>
          <span class="flex cursor-help items-center gap-1">
            <component :is="spo2Status.icon" :class="spo2Status.color" class="size-3" />
            SpO2 <span :class="spo2Status.color" class="font-medium">{{ spo2Status.label }}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="max-w-56 text-xs">
          <p class="font-medium">Oxygen Saturation (%)</p>
          <p>95–100 Normal</p>
          <p>90–94 Low</p>
          <p>&lt;90 Critical</p>
        </TooltipContent>
      </Tooltip>

      <span v-if="rrStatus" class="sep" />
      <Tooltip v-if="rrStatus">
        <TooltipTrigger as-child>
          <span class="flex cursor-help items-center gap-1">
            <component :is="rrStatus.icon" :class="rrStatus.color" class="size-3" />
            RR <span :class="rrStatus.color" class="font-medium">{{ rrStatus.label }}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="max-w-56 text-xs">
          <p class="font-medium">Respiratory Rate (breaths/min)</p>
          <p>&lt;12 Low</p>
          <p>12–20 Normal</p>
          <p>&gt;20 Elevated</p>
        </TooltipContent>
      </Tooltip>

      <span v-if="bsStatus" class="sep" />
      <Tooltip v-if="bsStatus">
        <TooltipTrigger as-child>
          <span class="flex cursor-help items-center gap-1">
            <component :is="bsStatus.icon" :class="bsStatus.color" class="size-3" />
            BS <span :class="bsStatus.color" class="font-medium">{{ bsStatus.label }}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="max-w-56 text-xs">
          <p class="font-medium">Blood Sugar (mg/dL, fasting)</p>
          <p>&lt;70 Low (Hypoglycemia)</p>
          <p>70–100 Normal</p>
          <p>101–125 Pre-diabetic</p>
          <p>&gt;125 High (Diabetic)</p>
        </TooltipContent>
      </Tooltip>
    </div>

    <!-- Allergies & Conditions -->
    <div v-if="hasAllergies || hasConditions" class="flex flex-wrap items-center gap-1.5 text-xs">
      <template v-if="hasAllergies">
        <span class="flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
          <ShieldAlert class="size-3" />
          Allergies
        </span>
        <span
          v-for="allergy in allergies"
          :key="allergy"
          class="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
        >
          {{ allergy }}
        </span>
      </template>
      <span v-if="hasAllergies && hasConditions" class="mx-1 h-3 w-px bg-border" />
      <template v-if="hasConditions">
        <span class="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
          <HeartPulse class="size-3" />
          Conditions
        </span>
        <span
          v-for="condition in conditions"
          :key="condition"
          class="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
        >
          {{ condition }}
        </span>
      </template>
    </div>
    <!-- Past Diagnoses -->
    <div v-if="hasPastDiagnoses" class="flex flex-wrap items-center gap-1.5 text-xs">
      <span class="flex items-center gap-1 font-medium text-muted-foreground">
        <History class="size-3" />
        Recent Dx
      </span>
      <button
        v-for="(dx, i) in pastDiagnoses"
        :key="i"
        type="button"
        class="rounded-full border bg-muted/50 px-2 py-0.5 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-foreground"
        @click="openConsultationPreview(dx.consultationId)"
      >
        {{ dx.description }}<span v-if="dx.code" class="ml-0.5 opacity-60">({{ dx.code }})</span>
        <span class="ml-0.5 opacity-50">{{ formatShortDate(dx.date) }}</span>
      </button>
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
        variant="ghost"
        size="sm"
        class="ml-auto h-6 gap-1 px-2 text-xs text-muted-foreground"
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
        <div v-else-if="weightData.length === 0 && bpData.length === 0 && bsData.length === 0" class="flex flex-col items-center justify-center gap-3 py-12 text-center">
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
