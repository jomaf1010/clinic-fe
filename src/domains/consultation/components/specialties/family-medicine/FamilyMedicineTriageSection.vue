<script setup lang="ts">
import { reactive, ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useSpecialtyConfigStore } from '@/stores/specialtyConfigStore'
import { MessageSquare, ChevronRight, Cigarette, Wine, Activity, Pill, Salad, TrendingUp } from 'lucide-vue-next'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import VitalsSummary from '../../VitalsSummary.vue'
import VitalFieldRenderer from '../../VitalFieldRenderer.vue'
import LabOrderSection from '../../LabOrderSection.vue'
import PatientHistorySection from '../PatientHistorySection.vue'
import { CORE_VITAL_KEYS, splitVitalsForApi } from '../../../utils/vitalsHelper'
import { consultationApi } from '../../../api/consultationApi'
import { patientApi } from '@/domains/patient/api/patientApi'
import type { ConsultationTriage, LifestyleData } from '../../../types/consultation.types'
import type { LabOrderResponse } from '../../../types/labOrder.types'
import type { ChronicTrendsData } from '@/domains/patient/types/patient.types'

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

const authStore = useAuthStore()
const specialtyConfigStore = useSpecialtyConfigStore()
const hasLabOrders = computed(() => authStore.hasFeature('lab_orders'))

const vitalFields = computed(() => specialtyConfigStore.config?.vitals ?? [])

// ── Local state ───────────────────────────────────────────────────────────
const allVitals = reactive<Record<string, string | number | null>>({
  bp: props.triage.vitals?.bp ?? null,
  hr: props.triage.vitals?.hr ?? null,
  rr: props.triage.vitals?.rr ?? null,
  temp: props.triage.vitals?.temp ?? null,
  spo2: props.triage.vitals?.spo2 ?? null,
  blood_sugar: props.triage.vitals?.blood_sugar ?? null,
  ...(props.triage.extended_vitals ?? {}),
})

const local = reactive({
  chief_complaint: props.triage.chief_complaint,
  weight: props.triage.weight,
  height: props.triage.height,
  pain_score: props.triage.pain_score,
  notes: props.triage.notes,
})

// ── Lifestyle ─────────────────────────────────────────────────────────────
const lifestyleOpen = ref(false)
const lifestyle = reactive<LifestyleData>({
  smoking: props.triage.specialty_data?.lifestyle?.smoking ?? null,
  pack_years: props.triage.specialty_data?.lifestyle?.pack_years ?? null,
  alcohol: props.triage.specialty_data?.lifestyle?.alcohol ?? null,
  exercise: props.triage.specialty_data?.lifestyle?.exercise ?? null,
  diet: props.triage.specialty_data?.lifestyle?.diet ?? null,
  medication_adherence: props.triage.specialty_data?.lifestyle?.medication_adherence ?? null,
})

const showPackYears = computed(() => lifestyle.smoking === 'current' || lifestyle.smoking === 'former')

watch(
  () => props.triage,
  (t) => {
    local.chief_complaint = t.chief_complaint
    local.weight = t.weight
    local.height = t.height
    local.pain_score = t.pain_score
    local.notes = t.notes

    for (const key of Object.keys(allVitals)) delete allVitals[key]
    Object.assign(allVitals, {
      bp: t.vitals?.bp ?? null,
      hr: t.vitals?.hr ?? null,
      rr: t.vitals?.rr ?? null,
      temp: t.vitals?.temp ?? null,
      spo2: t.vitals?.spo2 ?? null,
      blood_sugar: t.vitals?.blood_sugar ?? null,
      ...(t.extended_vitals ?? {}),
    })

    // Sync lifestyle from incoming triage
    if (t.specialty_data?.lifestyle) {
      Object.assign(lifestyle, t.specialty_data.lifestyle)
    }
  },
  { deep: true },
)

// Pre-populate lifestyle from previous consultation
onMounted(async () => {
  // Only pre-populate if the current consultation has no lifestyle data
  const hasExistingLifestyle = props.triage.specialty_data?.lifestyle &&
    Object.values(props.triage.specialty_data.lifestyle).some((v) => v !== null && v !== undefined)
  if (hasExistingLifestyle) return

  try {
    const res = await consultationApi.list(props.patientId, 1, 5)
    const previous = res.data.find(
      (c) => c.status === 'finalized' && c.id !== props.consultationId,
    )
    if (previous?.triage?.specialty_data?.lifestyle) {
      Object.assign(lifestyle, previous.triage.specialty_data.lifestyle)
    }
  } catch {
    // silently ignore
  }

  // Load chronic trends
  await loadTrends()
})

// ── Validation ────────────────────────────────────────────────────────────
const errors = ref<Record<string, string>>({})

function validate(): boolean {
  const e: Record<string, string> = {}

  for (const field of vitalFields.value) {
    if (field.type === 'bp' || field.type === 'enum') continue
    const val = allVitals[field.key]
    if (val === null || val === undefined || String(val) === '') continue
    const num = Number(val)
    if (field.min !== null && num < field.min) {
      e[field.key] = `Must be at least ${field.min}${field.unit ? ' ' + field.unit : ''}`
    } else if (field.max !== null && num > field.max) {
      e[field.key] = `Must be at most ${field.max}${field.unit ? ' ' + field.unit : ''}`
    }
  }

  errors.value = e
  return Object.keys(e).length === 0
}

function onBlur(): void {
  if (!validate()) return
  emitSave()
}

function onLifestyleChange() {
  emitSave()
}

function emitSave() {
  const { vitals, extended_vitals } = splitVitalsForApi(allVitals, CORE_VITAL_KEYS)
  emit('save', {
    triage: {
      chief_complaint: local.chief_complaint,
      vitals: vitals as ConsultationTriage['vitals'],
      weight: local.weight,
      height: local.height,
      pain_score: local.pain_score,
      notes: local.notes,
      extended_vitals,
      specialty_data: {
        lifestyle: { ...lifestyle },
      },
    },
  })
}

// ── Chronic Trends ────────────────────────────────────────────────────────
const trendsOpen = ref(false)
const trendsData = ref<ChronicTrendsData | null>(null)
const isLoadingTrends = ref(false)

async function loadTrends() {
  if (!props.patientId) return
  isLoadingTrends.value = true
  try {
    const res = await patientApi.getChronicTrends(props.patientId)
    trendsData.value = res.data
  } catch {
    // silently ignore
  } finally {
    isLoadingTrends.value = false
  }
}

// ── Sparkline helpers ─────────────────────────────────────────────────────
function buildSparklinePath(points: number[], width: number, height: number): string {
  if (points.length < 2) return ''
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const step = width / (points.length - 1)
  return points
    .map((v, i) => {
      const x = i * step
      const y = height - ((v - min) / range) * (height - 6) - 3
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

interface SparklineDataset {
  label: string
  values: number[]
  dates: string[]
  unit: string
  classificationMap: Record<string, string>
}

function classificationColor(cls: string | null | undefined): string {
  switch (cls) {
    case 'normal': return 'text-green-600'
    case 'elevated': return 'text-yellow-600'
    case 'high_stage_1': return 'text-orange-600'
    case 'high_stage_2': return 'text-red-600'
    case 'pre_diabetic': return 'text-yellow-600'
    case 'diabetic': return 'text-red-600'
    case 'underweight': return 'text-blue-600'
    case 'overweight': return 'text-yellow-600'
    case 'obese': return 'text-red-600'
    default: return 'text-muted-foreground'
  }
}

const sparklineDatasets = computed<SparklineDataset[]>(() => {
  if (!trendsData.value) return []
  const result: SparklineDataset[] = []

  const bp = trendsData.value.bp ?? []
  if (bp.length > 0) {
    const systolicValues = bp.map((p) => p.systolic ?? 0).filter(Boolean)
    const diastolicValues = bp.map((p) => p.diastolic ?? 0).filter(Boolean)
    if (systolicValues.length > 0) {
      result.push({
        label: 'BP (Systolic)',
        values: systolicValues,
        dates: bp.map((p) => p.date),
        unit: 'mmHg',
        classificationMap: Object.fromEntries(bp.map((p, i) => [i, p.classification ?? ''])),
      })
    }
    if (diastolicValues.length > 0) {
      result.push({
        label: 'BP (Diastolic)',
        values: diastolicValues,
        dates: bp.map((p) => p.date),
        unit: 'mmHg',
        classificationMap: {},
      })
    }
  }

  const bs = trendsData.value.blood_sugar ?? []
  if (bs.length > 0) {
    result.push({
      label: 'Blood Sugar',
      values: bs.map((p) => p.value ?? 0),
      dates: bs.map((p) => p.date),
      unit: 'mg/dL',
      classificationMap: Object.fromEntries(bs.map((p, i) => [i, p.classification ?? ''])),
    })
  }

  const wt = trendsData.value.weight ?? []
  if (wt.length > 0) {
    result.push({
      label: 'Weight',
      values: wt.map((p) => p.value ?? 0),
      dates: wt.map((p) => p.date),
      unit: 'kg',
      classificationMap: {},
    })
  }

  const bmi = trendsData.value.bmi ?? []
  if (bmi.length > 0) {
    result.push({
      label: 'BMI',
      values: bmi.map((p) => p.value ?? 0),
      dates: bmi.map((p) => p.date),
      unit: '',
      classificationMap: Object.fromEntries(bmi.map((p, i) => [i, p.classification ?? ''])),
    })
  }

  return result
})

function formatTrendDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

// Tooltip state
const hoveredPoint = ref<{ datasetIdx: number; pointIdx: number } | null>(null)
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Quick Assessment Summary -->
    <VitalsSummary :triage="{ ...local, vitals: allVitals as ConsultationTriage['vitals'] }" />

    <!-- Chief Complaint -->
    <div class="flex flex-col gap-2">
      <Label for="chief_complaint" class="flex items-center gap-1.5">
        <MessageSquare class="size-3.5 text-muted-foreground" />
        Chief Complaint
      </Label>
      <Textarea
        id="chief_complaint"
        :model-value="local.chief_complaint ?? undefined"
        placeholder="Patient's main concern..."
        :disabled="disabled"
        rows="3"
        @update:model-value="(v: string | number) => local.chief_complaint = String(v) || null"
        @blur="onBlur"
      />
    </div>

    <!-- Vitals (config-driven) -->
    <div>
      <h2 class="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide">Vitals</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <VitalFieldRenderer
          v-for="field in vitalFields"
          :key="field.key"
          :field-config="field"
          :model-value="allVitals[field.key] ?? null"
          :disabled="disabled"
          :error="errors[field.key]"
          @update:model-value="(v) => { allVitals[field.key] = v }"
          @blur="onBlur"
        />
      </div>
    </div>

    <!-- Lifestyle & Risk Factors -->
    <Collapsible v-model:open="lifestyleOpen">
      <CollapsibleTrigger class="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
        <ChevronRight class="size-3.5 transition-transform" :class="lifestyleOpen ? 'rotate-90' : ''" />
        Lifestyle & Risk Factors
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <!-- Smoking -->
          <div class="flex flex-col gap-1.5">
            <Label class="flex items-center gap-1.5 text-xs">
              <Cigarette class="size-3.5 text-muted-foreground" />
              Smoking Status
            </Label>
            <Select
              :model-value="lifestyle.smoking ?? ''"
              :disabled="disabled"
              @update:model-value="(v) => { lifestyle.smoking = (v || null) as LifestyleData['smoking']; onLifestyleChange() }"
            >
              <SelectTrigger class="h-8 text-sm">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="former">Former</SelectItem>
                <SelectItem value="current">Current</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Pack years (conditional) -->
          <div v-if="showPackYears" class="flex flex-col gap-1.5">
            <Label class="flex items-center gap-1.5 text-xs">
              <Cigarette class="size-3.5 text-muted-foreground" />
              Pack Years
            </Label>
            <Input
              :model-value="lifestyle.pack_years ?? undefined"
              type="number"
              min="0"
              step="0.5"
              placeholder="e.g. 10"
              class="h-8 text-sm"
              :disabled="disabled"
              @update:model-value="(v) => lifestyle.pack_years = v ? Number(v) : null"
              @blur="onLifestyleChange"
            />
          </div>

          <!-- Alcohol -->
          <div class="flex flex-col gap-1.5">
            <Label class="flex items-center gap-1.5 text-xs">
              <Wine class="size-3.5 text-muted-foreground" />
              Alcohol Use
            </Label>
            <Select
              :model-value="lifestyle.alcohol ?? ''"
              :disabled="disabled"
              @update:model-value="(v) => { lifestyle.alcohol = (v || null) as LifestyleData['alcohol']; onLifestyleChange() }"
            >
              <SelectTrigger class="h-8 text-sm">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="occasional">Occasional</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Exercise -->
          <div class="flex flex-col gap-1.5">
            <Label class="flex items-center gap-1.5 text-xs">
              <Activity class="size-3.5 text-muted-foreground" />
              Physical Activity
            </Label>
            <Select
              :model-value="lifestyle.exercise ?? ''"
              :disabled="disabled"
              @update:model-value="(v) => { lifestyle.exercise = (v || null) as LifestyleData['exercise']; onLifestyleChange() }"
            >
              <SelectTrigger class="h-8 text-sm">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentary</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="active">Active</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Diet -->
          <div class="flex flex-col gap-1.5">
            <Label class="flex items-center gap-1.5 text-xs">
              <Salad class="size-3.5 text-muted-foreground" />
              Diet Quality
            </Label>
            <Select
              :model-value="lifestyle.diet ?? ''"
              :disabled="disabled"
              @update:model-value="(v) => { lifestyle.diet = (v || null) as LifestyleData['diet']; onLifestyleChange() }"
            >
              <SelectTrigger class="h-8 text-sm">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Medication adherence -->
          <div class="flex flex-col gap-1.5">
            <Label class="flex items-center gap-1.5 text-xs">
              <Pill class="size-3.5 text-muted-foreground" />
              Medication Adherence
            </Label>
            <Select
              :model-value="lifestyle.medication_adherence ?? ''"
              :disabled="disabled"
              @update:model-value="(v) => { lifestyle.medication_adherence = (v || null) as LifestyleData['medication_adherence']; onLifestyleChange() }"
            >
              <SelectTrigger class="h-8 text-sm">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>

    <!-- Chronic Disease Trends -->
    <Collapsible v-model:open="trendsOpen">
      <CollapsibleTrigger class="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors">
        <ChevronRight class="size-3.5 transition-transform" :class="trendsOpen ? 'rotate-90' : ''" />
        <TrendingUp class="size-3.5" />
        Chronic Disease Trends
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div v-if="isLoadingTrends" class="mt-4 text-sm text-muted-foreground">Loading trends...</div>
        <div
          v-else-if="sparklineDatasets.length === 0"
          class="mt-4 text-sm text-muted-foreground"
        >
          No trend data available. Trends appear after finalized consultations with vitals.
        </div>
        <div v-else class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div
            v-for="(dataset, dIdx) in sparklineDatasets"
            :key="dataset.label"
            class="rounded-lg border bg-card p-3"
          >
            <p class="mb-2 text-xs font-medium text-muted-foreground">{{ dataset.label }}</p>

            <!-- Sparkline SVG -->
            <div class="relative">
              <svg
                viewBox="0 0 200 48"
                class="w-full h-12"
                aria-hidden="true"
              >
                <path
                  :d="buildSparklinePath(dataset.values, 200, 48)"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="text-primary"
                />
                <!-- Hover dots -->
                <circle
                  v-for="(v, pIdx) in dataset.values"
                  :key="pIdx"
                  :cx="dataset.values.length > 1 ? (pIdx * 200 / (dataset.values.length - 1)).toFixed(1) : 100"
                  :cy="(() => {
                    const min = Math.min(...dataset.values)
                    const max = Math.max(...dataset.values)
                    const range = max - min || 1
                    return (48 - ((v - min) / range) * (48 - 6) - 3).toFixed(1)
                  })()"
                  r="3"
                  class="fill-primary cursor-pointer transition-opacity"
                  :opacity="hoveredPoint?.datasetIdx === dIdx && hoveredPoint?.pointIdx === pIdx ? 1 : 0"
                  @mouseenter="hoveredPoint = { datasetIdx: dIdx, pointIdx: pIdx }"
                  @mouseleave="hoveredPoint = null"
                />
                <!-- Invisible hit area for hover -->
                <rect
                  v-for="(v, pIdx) in dataset.values"
                  :key="`hit-${pIdx}`"
                  :x="dataset.values.length > 1 ? (pIdx * 200 / (dataset.values.length - 1) - 8).toFixed(1) : 92"
                  y="0"
                  width="16"
                  height="48"
                  fill="transparent"
                  class="cursor-pointer"
                  @mouseenter="hoveredPoint = { datasetIdx: dIdx, pointIdx: pIdx }"
                  @mouseleave="hoveredPoint = null"
                />
              </svg>

              <!-- Tooltip -->
              <div
                v-if="hoveredPoint?.datasetIdx === dIdx && hoveredPoint.pointIdx < dataset.values.length"
                class="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
              >
                <span class="font-medium">{{ dataset.values[hoveredPoint.pointIdx] }}{{ dataset.unit ? ' ' + dataset.unit : '' }}</span>
                <span
                  v-if="dataset.classificationMap[hoveredPoint.pointIdx]"
                  class="ml-1 capitalize"
                  :class="classificationColor(dataset.classificationMap[hoveredPoint.pointIdx])"
                >
                  ({{ dataset.classificationMap[hoveredPoint.pointIdx].replace(/_/g, ' ') }})
                </span>
                <br />
                <span class="text-muted-foreground">{{ formatTrendDate(dataset.dates[hoveredPoint.pointIdx]) }}</span>
              </div>
            </div>

            <!-- Latest value -->
            <div class="mt-1.5 flex items-baseline gap-1">
              <span class="text-sm font-semibold">
                {{ dataset.values[dataset.values.length - 1] }}{{ dataset.unit ? ' ' + dataset.unit : '' }}
              </span>
              <span
                v-if="dataset.classificationMap[dataset.values.length - 1]"
                class="text-xs capitalize"
                :class="classificationColor(dataset.classificationMap[dataset.values.length - 1])"
              >
                {{ dataset.classificationMap[dataset.values.length - 1].replace(/_/g, ' ') }}
              </span>
              <span class="ml-auto text-xs text-muted-foreground">
                {{ dataset.values.length }} readings
              </span>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>

    <!-- Lab Orders -->
    <LabOrderSection
      v-if="hasLabOrders"
      :consultation-id="consultationId"
      :disabled="disabled"
      :realtime-update="labOrderUpdate"
      @lab-updated="emit('lab-updated')"
    />

    <!-- Triage Notes -->
    <div class="flex flex-col gap-2">
      <Label for="triage_notes" class="flex items-center gap-1.5">
        <MessageSquare class="size-3.5 text-muted-foreground" />
        Triage Notes
      </Label>
      <Textarea
        id="triage_notes"
        :model-value="local.notes ?? undefined"
        placeholder="Additional triage notes..."
        :disabled="disabled"
        rows="3"
        @update:model-value="(v: string | number) => local.notes = String(v) || null"
        @blur="onBlur"
      />
    </div>

    <!-- Patient History (Allergies & Conditions) -->
    <PatientHistorySection
      :patient-id="patientId"
      :patient-allergies="patientAllergies"
      :patient-conditions="patientConditions"
      :disabled="disabled"
      @patient-updated="emit('patient-updated')"
    />
  </div>
</template>
