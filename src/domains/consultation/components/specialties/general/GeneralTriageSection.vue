<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { Weight, Activity, Ruler, MessageSquare } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import VitalsSummary from '../../VitalsSummary.vue'
import VitalFieldRenderer from '../../VitalFieldRenderer.vue'
import LabOrderSection from '../../LabOrderSection.vue'
import PatientHistorySection from '../PatientHistorySection.vue'
import type { ConsultationTriage } from '../../../types/consultation.types'
import type { VitalFieldConfig } from '@/domains/specialty/types/specialty.types'
import type { LabOrderResponse } from '../../../types/labOrder.types'

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

const CORE_VITAL_KEYS = new Set(['bp', 'hr', 'rr', 'temp', 'spo2', 'blood_sugar'])

// ── Local state ───────────────────────────────────────────────────────────
const local = reactive<ConsultationTriage>({
  chief_complaint: props.triage.chief_complaint,
  vitals: {
    bp: props.triage.vitals?.bp ?? null,
    hr: props.triage.vitals?.hr ?? null,
    rr: props.triage.vitals?.rr ?? null,
    temp: props.triage.vitals?.temp ?? null,
    spo2: props.triage.vitals?.spo2 ?? null,
    blood_sugar: props.triage.vitals?.blood_sugar ?? null,
  },
  weight: props.triage.weight,
  height: props.triage.height,
  pain_score: props.triage.pain_score,
  notes: props.triage.notes,
})

const localExtendedVitals = reactive<Record<string, string | number | null>>(
  { ...(props.triage.extended_vitals ?? {}) },
)

watch(
  () => props.triage,
  (t) => {
    local.chief_complaint = t.chief_complaint
    local.vitals.bp = t.vitals?.bp ?? null
    local.vitals.hr = t.vitals?.hr ?? null
    local.vitals.rr = t.vitals?.rr ?? null
    local.vitals.temp = t.vitals?.temp ?? null
    local.vitals.spo2 = t.vitals?.spo2 ?? null
    local.vitals.blood_sugar = t.vitals?.blood_sugar ?? null
    local.weight = t.weight
    local.height = t.height
    local.pain_score = t.pain_score
    local.notes = t.notes
    const newExtended = t.extended_vitals ?? {}
    Object.keys(localExtendedVitals).forEach((k) => delete localExtendedVitals[k])
    Object.assign(localExtendedVitals, newExtended)
  },
  { deep: true },
)

// ── Vital value accessors ─────────────────────────────────────────────────
function getVitalValue(key: string): string | number | null {
  if (CORE_VITAL_KEYS.has(key)) {
    return (local.vitals as Record<string, string | number | null>)[key] ?? null
  }
  return localExtendedVitals[key] ?? null
}

function setVitalValue(key: string, val: string | number | null) {
  if (CORE_VITAL_KEYS.has(key)) {
    ;(local.vitals as Record<string, string | number | null>)[key] = val
  } else {
    localExtendedVitals[key] = val
  }
}

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
    const converted = cmToFtIn(local.height)
    heightFeet.value = converted?.feet ?? null
    heightInches.value = converted?.inches ?? null
    heightUnit.value = 'ft'
  } else {
    heightUnit.value = 'cm'
  }
}

function onFtInUpdate() {
  local.height = ftInToCm(heightFeet.value, heightInches.value)
  onBlur()
}

// ── Pain score ────────────────────────────────────────────────────────────
const painLabel = computed(() => {
  if (local.pain_score === null || local.pain_score === 0) return null
  if (local.pain_score <= 3) return { label: 'Mild', color: 'text-green-600' }
  if (local.pain_score <= 6) return { label: 'Moderate', color: 'text-amber-600' }
  return { label: 'Severe', color: 'text-red-600' }
})

// ── Validation ────────────────────────────────────────────────────────────
const errors = ref<Record<string, string>>({})

function validate(): boolean {
  const e: Record<string, string> = {}

  for (const field of DEFAULT_VITAL_FIELDS) {
    if (field.type === 'bp' || field.type === 'enum') continue
    const val = getVitalValue(field.key)
    if (val === null || val === undefined || String(val) === '') continue
    const num = Number(val)
    if (field.min !== null && num < field.min) {
      e[field.key] = `Must be at least ${field.min}${field.unit ? ' ' + field.unit : ''}`
    } else if (field.max !== null && num > field.max) {
      e[field.key] = `Must be at most ${field.max}${field.unit ? ' ' + field.unit : ''}`
    }
  }

  if (local.weight !== null && (local.weight < 0.5 || local.weight > 500))
    e.weight = 'Must be between 0.5 and 500 kg'
  if (local.height !== null && (local.height < 30 || local.height > 300))
    e.height = 'Must be between 30 and 300 cm'

  errors.value = e
  return Object.keys(e).length === 0
}

function onBlur(): void {
  if (!validate()) return
  emitSave()
}

function onPainScoreChange(val: number[]) {
  local.pain_score = val[0]
  emitSave()
}

function emitSave() {
  emit('save', {
    triage: {
      chief_complaint: local.chief_complaint,
      vitals: { ...local.vitals },
      weight: local.weight,
      height: local.height,
      pain_score: local.pain_score,
      notes: local.notes,
      extended_vitals: { ...localExtendedVitals },
    },
  })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Quick Assessment Summary -->
    <VitalsSummary :triage="local" />

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

    <!-- Vitals -->
    <div>
      <h2 class="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide">Vitals</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <VitalFieldRenderer
          v-for="field in DEFAULT_VITAL_FIELDS"
          :key="field.key"
          :field-config="field"
          :model-value="getVitalValue(field.key)"
          :disabled="disabled"
          :error="errors[field.key]"
          @update:model-value="(v) => { setVitalValue(field.key, v) }"
          @blur="onBlur"
        />
      </div>
    </div>

    <!-- Measurements (Weight, Height, Pain Score) -->
    <div>
      <h2 class="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wide">Measurements</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-start">
        <div class="flex flex-col gap-2">
          <div class="flex h-6 items-center">
            <Label for="weight" class="flex items-center gap-1.5">
              <Weight class="size-3.5 text-muted-foreground" />
              Weight (kg)
            </Label>
          </div>
          <Input
            id="weight"
            :model-value="local.weight ?? undefined"
            type="number"
            placeholder="70"
            step="0.1"
            :disabled="disabled"
            @update:model-value="(v: string | number) => { const n = Number(v); local.weight = isNaN(n) ? null : n }"
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
            :model-value="local.height ?? undefined"
            type="number"
            placeholder="170"
            :disabled="disabled"
            @update:model-value="(v: string | number) => { const n = Number(v); local.height = isNaN(n) ? null : n }"
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
              <span v-if="local.pain_score !== null" class="ml-1 font-mono text-base font-semibold">
                {{ local.pain_score }}/10
              </span>
              <span v-if="painLabel" :class="painLabel.color" class="text-xs font-medium">
                ({{ painLabel.label }})
              </span>
            </Label>
          </div>
          <Slider
            :model-value="[local.pain_score ?? 0]"
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
