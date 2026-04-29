<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { Weight, Activity, Ruler, MessageSquare } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import VitalFieldRenderer from '../../VitalFieldRenderer.vue'
import LabOrderSection from '../../LabOrderSection.vue'
import type { ConsultationTriage } from '../../../types/consultation.types'
import type { VitalFieldConfig } from '@/domains/specialty/types/specialty.types'
import type { LabOrderResponse } from '../../../types/labOrder.types'

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

const authStore = useAuthStore()
const hasLabOrders = computed(() => authStore.hasFeature('lab_orders'))

// ── Default vital fields (6 core vitals — no specialty config) ────────────
const DEFAULT_VITAL_FIELDS: VitalFieldConfig[] = [
  {
    key: 'bp', label: 'Blood Pressure', unit: null, type: 'bp',
    input_type: 'paired_number', min: null, max: null, required: false, order: 1,
    age_ranges: null, show_if: null, options: null,
  },
  {
    key: 'hr', label: 'Heart Rate', unit: 'bpm', type: 'integer',
    input_type: 'number', min: 20, max: 300, required: false, order: 2,
    age_ranges: null, show_if: null, options: null,
  },
  {
    key: 'rr', label: 'Respiratory Rate', unit: 'breaths/min', type: 'integer',
    input_type: 'number', min: 4, max: 60, required: false, order: 3,
    age_ranges: null, show_if: null, options: null,
  },
  {
    key: 'temp', label: 'Temperature', unit: '°C', type: 'numeric',
    input_type: 'number', min: 30, max: 45, required: false, order: 4,
    age_ranges: null, show_if: null, options: null,
  },
  {
    key: 'spo2', label: 'SpO2', unit: '%', type: 'integer',
    input_type: 'number', min: 50, max: 100, required: false, order: 5,
    age_ranges: null, show_if: null, options: null,
  },
  {
    key: 'blood_sugar', label: 'Blood Sugar', unit: 'mg/dL', type: 'integer',
    input_type: 'number', min: 20, max: 600, required: false, order: 6,
    age_ranges: null, show_if: null, options: null,
  },
]

const renderedVitalFields = DEFAULT_VITAL_FIELDS.filter((field) => field.key !== 'blood_sugar')
const BLOOD_GLUCOSE_TIMING_OPTIONS = [
  { value: 'fasting', label: 'Fasting' },
  { value: 'random', label: 'Random' },
  { value: 'postprandial', label: 'Post-prandial' },
  { value: 'pre_meal', label: 'Pre-meal' },
  { value: 'post_meal', label: 'Post-meal' },
  { value: 'bedtime', label: 'Bedtime' },
] as const
type BloodGlucoseTiming = typeof BLOOD_GLUCOSE_TIMING_OPTIONS[number]['value']

// ── Local state ───────────────────────────────────────────────────────────
const allVitals = reactive<Record<string, string | number | null>>({
  ...(props.triage.vitals ?? {}),
})

const local = reactive({
  chief_complaint: props.triage.chief_complaint,
  notes: props.triage.notes,
})

watch(
  () => props.triage,
  (t) => {
    local.chief_complaint = t.chief_complaint
    local.notes = t.notes
    for (const key of Object.keys(allVitals)) delete allVitals[key]
    Object.assign(allVitals, { ...(t.vitals ?? {}) })
  },
  { deep: true },
)

// ── Height unit toggle ────────────────────────────────────────────────────
const heightUnit = ref<'cm' | 'ft'>('cm')
const heightFeet = ref<number | null>(null)
const heightInches = ref<number | null>(null)

function ftInToCm(feet: number | null, inches: number | null): number | null {
  if (feet === null && inches === null) return null
  const totalInches = (feet ?? 0) * 12 + (inches ?? 0)
  return Math.round(totalInches * 2.54 * 10) / 10
}

function cmToFtIn(cm: number | null): { feet: number; inches: number } | null {
  if (cm === null) return null
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches % 12)
  return { feet, inches }
}

function toggleHeightUnit() {
  if (heightUnit.value === 'cm') {
    const converted = cmToFtIn(allVitals['height'] as number | null)
    heightFeet.value = converted?.feet ?? null
    heightInches.value = converted?.inches ?? null
    heightUnit.value = 'ft'
  } else {
    heightUnit.value = 'cm'
  }
}

function onFtInUpdate() {
  allVitals['height'] = ftInToCm(heightFeet.value, heightInches.value)
  onBlur()
}

// ── Pain score ────────────────────────────────────────────────────────────
const painLabel = computed(() => {
  const score = allVitals['pain_score'] as number | null
  if (score === null || score === 0) return null
  if (score <= 3) return { label: 'Mild', color: 'text-green-600' }
  if (score <= 6) return { label: 'Moderate', color: 'text-amber-600' }
  return { label: 'Severe', color: 'text-red-600' }
})

// ── Validation ────────────────────────────────────────────────────────────
const errors = ref<Record<string, string>>({})

function validate(): boolean {
  const e: Record<string, string> = {}

  for (const field of DEFAULT_VITAL_FIELDS) {
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

  const weight = allVitals['weight'] as number | null
  const height = allVitals['height'] as number | null
  if (weight !== null && (weight < 0.5 || weight > 500))
    e.weight = 'Must be between 0.5 and 500 kg'
  if (height !== null && (height < 30 || height > 300))
    e.height = 'Must be between 30 and 300 cm'

  errors.value = e
  return Object.keys(e).length === 0
}

function onBlur(): void {
  if (!validate()) return
  emitSave()
}

function onPainScoreChange(val: number[]) {
  allVitals['pain_score'] = val[0]
  emitSave()
}

function onBloodSugarUpdate(val: string | number) {
  const num = Number(val)
  allVitals['blood_sugar'] = isNaN(num) || String(val) === '' ? null : num
  if (allVitals['blood_sugar'] !== null && !allVitals['blood_glucose_timing']) {
    allVitals['blood_glucose_timing'] = 'random'
  }
}

function onBloodGlucoseTimingUpdate(val: BloodGlucoseTiming) {
  allVitals['blood_glucose_timing'] = val
  onBlur()
}

function emitSave() {
  emit('save', {
    triage: {
      chief_complaint: local.chief_complaint,
      vitals: { ...allVitals },
      notes: local.notes,
    },
  })
}
</script>

<template>
  <div class="flex flex-col divide-y divide-dashed divide-border [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
    <!-- Chief Complaint -->
    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Chief Complaint</h3>
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

    <!-- Vitals -->
    <div>
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Vitals</h3>
      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <VitalFieldRenderer
          v-for="field in renderedVitalFields"
          :key="field.key"
          :field-config="field"
          :model-value="allVitals[field.key] ?? null"
          :vitals="allVitals"
          :disabled="disabled"
          :error="errors[field.key]"
          @update:model-value="(v) => { allVitals[field.key] = v }"
          @update:paired="(updates) => Object.assign(allVitals, updates)"
          @blur="onBlur"
        />

        <div class="flex flex-col gap-2">
          <div class="flex h-6 items-center">
            <Label for="blood_sugar">Blood Sugar (mg/dL)</Label>
          </div>
          <div class="grid grid-cols-[minmax(0,1fr)_minmax(8.5rem,0.85fr)] gap-1.5">
            <Input
              id="blood_sugar"
              :model-value="(allVitals['blood_sugar'] as number | null) ?? undefined"
              type="number"
              min="20"
              max="600"
              step="1"
              placeholder="70-200"
              :disabled="disabled"
              :aria-invalid="!!errors.blood_sugar"
              :class="errors.blood_sugar ? 'border-destructive focus-visible:ring-destructive' : ''"
              @update:model-value="onBloodSugarUpdate"
              @blur="onBlur"
            />
            <Select
              :model-value="(allVitals['blood_glucose_timing'] as string | null) ?? undefined"
              :disabled="disabled"
              @update:model-value="(v) => onBloodGlucoseTimingUpdate(v as BloodGlucoseTiming)"
            >
              <SelectTrigger aria-label="Blood glucose timing">
                <SelectValue placeholder="Timing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in BLOOD_GLUCOSE_TIMING_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p v-if="errors.blood_sugar" class="text-xs text-destructive">{{ errors.blood_sugar }}</p>
        </div>
      </div>
    </div>

    <!-- Measurements -->
    <div>
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Measurements</h3>
      <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 md:items-start">
        <div class="flex flex-col gap-2">
          <div class="flex h-6 items-center">
            <Label for="weight" class="flex items-center gap-1.5">
              <Weight class="size-3.5 text-muted-foreground" />
              Weight (kg)
            </Label>
          </div>
          <Input
            id="weight"
            :model-value="(allVitals['weight'] as number | null) ?? undefined"
            type="number"
            placeholder="70"
            step="0.1"
            :disabled="disabled"
            @update:model-value="(v: string | number) => { const n = Number(v); allVitals['weight'] = isNaN(n) ? null : n }"
            @blur="onBlur"
          />
          <p v-if="errors.weight" class="text-xs text-destructive">{{ errors.weight }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex h-6 items-center">
            <Label class="flex items-center gap-1.5">
              <Ruler class="size-3.5 text-muted-foreground" />
              Height ({{ heightUnit === 'cm' ? 'cm' : 'ft/in' }})
            </Label>
            <button
              type="button"
              class="ml-2 rounded-md border px-1.5 py-px text-[11px] font-medium leading-tight text-primary hover:bg-primary/10"
              :disabled="disabled"
              @click="toggleHeightUnit"
            >
              {{ heightUnit === 'cm' ? 'ft/in' : 'cm' }}
            </button>
          </div>
          <Input
            v-if="heightUnit === 'cm'"
            id="height"
            :model-value="(allVitals['height'] as number | null) ?? undefined"
            type="number"
            placeholder="170"
            :disabled="disabled"
            @update:model-value="(v: string | number) => { const n = Number(v); allVitals['height'] = isNaN(n) ? null : n }"
            @blur="onBlur"
          />
          <div v-else class="flex items-center gap-2">
            <Input
              :model-value="heightFeet ?? undefined"
              type="number"
              placeholder="5"
              :disabled="disabled"
              class="w-20"
              @update:model-value="(v: string | number) => { const n = Number(v); heightFeet = isNaN(n) ? null : n }"
              @blur="onFtInUpdate"
            />
            <span class="text-xs text-muted-foreground">ft</span>
            <Input
              :model-value="heightInches ?? undefined"
              type="number"
              placeholder="7"
              :disabled="disabled"
              class="w-20"
              @update:model-value="(v: string | number) => { const n = Number(v); heightInches = isNaN(n) ? null : n }"
              @blur="onFtInUpdate"
            />
            <span class="text-xs text-muted-foreground">in</span>
          </div>
          <p v-if="errors.height" class="text-xs text-destructive">{{ errors.height }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex h-6 items-center">
            <Label class="flex items-center gap-1.5">
              <Activity class="size-3.5 text-muted-foreground" />
              Pain Score
              <span v-if="allVitals['pain_score'] !== null" class="ml-1 font-mono text-base font-semibold">
                {{ allVitals['pain_score'] }}/10
              </span>
              <span v-if="painLabel" :class="painLabel.color" class="text-xs font-medium">
                ({{ painLabel.label }})
              </span>
            </Label>
          </div>
          <Slider
            :model-value="[(allVitals['pain_score'] as number | null) ?? 0]"
            :min="0"
            :max="10"
            :step="1"
            :disabled="disabled"
            class="mt-2.5 w-full"
            @update:model-value="onPainScoreChange"
          />
          <div class="flex justify-between text-[10px] text-muted-foreground">
            <span>0 - No pain</span>
            <span>10 - Worst pain</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Lab Orders -->
    <div v-if="hasLabOrders">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lab Orders</h3>
      <div class="mt-4">
        <LabOrderSection
          :encounter-id="encounterId"
          :disabled="disabled"
          :realtime-update="labOrderUpdate"
          @lab-updated="emit('lab-updated')"
        />
      </div>
    </div>

    <!-- Triage Notes -->
    <div class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Triage Notes</h3>
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

  </div>
</template>
